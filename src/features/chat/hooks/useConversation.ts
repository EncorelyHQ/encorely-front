import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isApiError, userMessage } from '@/lib/api/errors'
import type { MatchSummary, OutgoingMessage, SentMessage } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useUser } from '@/lib/session/SessionContext'
import { isE2eeError } from '../crypto'
import type { PeerTrustState } from '../keys'
import { useChatDeps } from '../data/ChatDepsContext'
import {
  addConfirmed,
  classifyPeerError,
  isClosedError,
  loadOlderPage,
  persistSent,
  redecryptFailed,
  syncConversation,
  type ConversationCtx,
} from '../data/conversation'
import { MAX_MESSAGE_LENGTH, withPending, type ChatMessage, type MessageStatus } from '../data/messages'
import { ensureKeysPublished } from '../data/publishKeys'
import { getChatSession, SendBlockedError } from '../data/session'
import { useMatch, usePeerKeys } from './useChatQueries'

export type PeerState =
  | { kind: 'loading' }
  // La otra persona nunca abrió la app con el cifrado activo: no hay a qué llave cifrar.
  | { kind: 'noKeys' }
  // Su paquete de llaves no tiene una firma válida: no se cifra nada.
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      trust: PeerTrustState
      canSend: boolean
      // Estaba verificado y cambió: el envío se bloquea hasta revisar el código.
      requiresConfirmation: boolean
    }

export type ConversationStatus = 'loading' | 'ready' | 'error' | 'closed'

export type ReportEvidenceItem = { messageId: string; plaintext: string; frankingKey: string }

const EVIDENCE_MAX = 20

type OutboxEntry = { text: string; at: number; envelope?: OutgoingMessage }

export function useConversation(matchId: string) {
  const { id } = useUser()
  return useConversationAs(matchId, id)
}

export function useConversationAs(matchId: string, me: string) {
  const deps = useChatDeps()
  const queryClient = useQueryClient()
  const session = getChatSession(deps, me)

  const matchQuery = useMatch(matchId)
  const match: MatchSummary | undefined = matchQuery.data
  const peerUserId = match?.peer.id
  const [closedBySend, setClosedBySend] = useState(false)
  const matchClosed =
    closedBySend || match?.status === 'closed' || (matchQuery.isError && isClosedError(matchQuery.error))
  const enabled = !!peerUserId && !matchClosed

  const peerQuery = usePeerKeys(matchId, me, enabled)
  const ctx: ConversationCtx | null = useMemo(
    () =>
      peerUserId
        ? { queryClient, session, transport: deps.transport, matchId, peerUserId, local: deps.local, now: deps.now }
        : null,
    [queryClient, session, deps.transport, deps.local, deps.now, matchId, peerUserId],
  )

  const messagesQuery = useQuery({
    queryKey: queryKeys.messages(matchId),
    queryFn: () => syncConversation(ctx!),
    enabled: enabled && !!ctx,
    // Siempre "viejo": volver a la conversación o a la app trae solo lo nuevo (after=syncedSeq).
    staleTime: 0,
    // En memoria, poco tiempo después de salir del chat; lo que dura está en la base local cifrada.
    gcTime: 60_000,
  })

  const peerProblem = peerQuery.error && !peerQuery.data ? classifyPeerError(peerQuery.error) : null
  const closed =
    matchClosed ||
    peerProblem === 'closed' ||
    (messagesQuery.isError && isClosedError(messagesQuery.error))

  const peerData = peerQuery.data
  const peerState: PeerState = useMemo(() => {
    if (peerData) {
      return {
        kind: 'ready',
        trust: peerData.pinned.state,
        canSend: peerData.canSend,
        requiresConfirmation: peerData.requiresConfirmation,
      }
    }
    if (peerProblem === 'noKeys') return { kind: 'noKeys' }
    if (peerProblem === 'invalid') return { kind: 'invalid' }
    if (peerProblem === 'error') return { kind: 'error', message: userMessage(peerQuery.error) }
    return { kind: 'loading' }
  }, [peerData, peerProblem, peerQuery.error])

  // El aviso de cambio de llave se queda visible el resto de la sesión aunque ya se haya aceptado.
  const [sawKeyChange, setSawKeyChange] = useState(false)
  const changedNow = peerData?.pinned.state === 'changed'
  if (changedNow && !sawKeyChange) setSawKeyChange(true)

  // --- Envío optimista ---
  const [pending, setPending] = useState<ChatMessage[]>([])
  const outbox = useRef(new Map<string, OutboxEntry>())

  const setPendingStatus = useCallback((id: string, status: MessageStatus) => {
    setPending((list) => list.map((m) => (m.id === id ? { ...m, status } : m)))
  }, [])

  const deliver = useCallback(
    async (id: string) => {
      const entry = outbox.current.get(id)
      if (!entry || !ctx) return
      setPendingStatus(id, 'sending')

      const seal = async () => {
        entry.envelope = await session.seal(matchId, ctx.peerUserId, { id, body: entry.text, sentAt: entry.at })
        return entry.envelope
      }
      const republishAndSeal = async () => {
        await ensureKeysPublished(deps, me, true)
        return seal()
      }

      try {
        let envelope: OutgoingMessage
        try {
          envelope = entry.envelope ?? (await seal())
        } catch (error) {
          if (!isE2eeError(error, 'missing_keys')) throw error
          envelope = await republishAndSeal()
        }

        let sent: SentMessage
        try {
          // Reintentar reenvía el MISMO sobre: si el primer POST sí llegó, el servidor responde 200 con el existente.
          sent = await deps.transport.send(matchId, envelope)
        } catch (error) {
          if (isApiError(error, 'stale_recipient_key')) {
            // El otro rotó su llave: se refresca y se vuelve a sellar con el mismo id.
            queryClient.setQueryData(queryKeys.peerKeys(matchId), await session.fetchPeer(matchId))
            envelope = await seal()
          } else if (isApiError(error, 'keys_missing') || isApiError(error, 'unknown_sender_key')) {
            envelope = await republishAndSeal()
          } else {
            throw error
          }
          sent = await deps.transport.send(matchId, envelope)
        }

        outbox.current.delete(id)
        const confirmed: ChatMessage = {
          id,
          seq: sent.seq,
          senderId: me,
          mine: true,
          at: Date.parse(sent.createdAt),
          status: 'sent',
          body: entry.text,
          kind: 'text',
        }
        addConfirmed(queryClient, matchId, confirmed)
        // Si la base falla, el mensaje igual se ve; se pierde solo de este teléfono cuando el otro lo confirme.
        persistSent(ctx, confirmed).catch(() => undefined)
        setPending((list) => list.filter((m) => m.id !== id))
      } catch (error) {
        if (isClosedError(error)) setClosedBySend(true)
        if (error instanceof SendBlockedError) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.peerKeys(matchId), exact: true })
        }
        setPendingStatus(id, 'failed')
      }
    },
    [ctx, deps, me, matchId, queryClient, session, setPendingStatus],
  )

  const send = useCallback(
    (text: string): boolean => {
      const body = text.trim()
      if (!body || body.length > MAX_MESSAGE_LENGTH || !ctx) return false
      const id = deps.newId()
      const at = deps.now()
      outbox.current.set(id, { text: body, at })
      setPending((list) => [...list, { id, seq: null, senderId: me, mine: true, at, status: 'sending', body }])
      void deliver(id)
      return true
    },
    [ctx, deliver, deps, me],
  )

  const retry = useCallback(
    (id: string) => {
      if (outbox.current.has(id)) void deliver(id)
    },
    [deliver],
  )

  // --- Historial hacia atrás ---
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState<string | null>(null)
  const loadingOlderRef = useRef(false)

  const loadOlder = useCallback(async () => {
    if (!ctx || loadingOlderRef.current) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    setOlderError(null)
    try {
      await loadOlderPage(ctx)
    } catch (error) {
      setOlderError(userMessage(error))
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [ctx])

  // --- Confianza ---
  const acceptKeyChange = useCallback(async () => {
    if (!ctx) return
    const snapshot = await session.acceptChange(matchId, ctx.peerUserId)
    if (snapshot) queryClient.setQueryData(queryKeys.peerKeys(matchId), snapshot)
    await redecryptFailed(ctx)
  }, [ctx, matchId, queryClient, session])

  const refresh = useCallback(async () => {
    await Promise.all([
      matchQuery.refetch(),
      enabled ? peerQuery.refetch() : null,
      enabled ? messagesQuery.refetch() : null,
    ])
  }, [enabled, matchQuery, messagesQuery, peerQuery])

  const confirmed = messagesQuery.data?.messages
  const messages = useMemo(() => withPending(confirmed ?? [], pending), [confirmed, pending])

  // Para el reporte: solo mensajes recibidos y descifrados aquí, con su franking key. Se arma al abrir el reporte.
  const evidence = useCallback(
    (): ReportEvidenceItem[] =>
      messages
        .filter((m) => !m.mine && m.evidence)
        .slice(-EVIDENCE_MAX)
        .map((m) => ({ messageId: m.id, plaintext: m.evidence!.plaintext, frankingKey: m.evidence!.frankingKey })),
    [messages],
  )

  const status: ConversationStatus = closed
    ? 'closed'
    : messagesQuery.data
      ? 'ready'
      : matchQuery.isError || messagesQuery.isError || peerProblem === 'error'
        ? 'error'
        : // Sin llaves del otro igual se puede mostrar el chat vacío con el aviso.
          peerProblem === 'noKeys' && !messagesQuery.isFetching
          ? 'ready'
          : 'loading'

  return {
    match,
    messages,
    hasMore: messagesQuery.data?.hasMore ?? false,
    loadOlder,
    loadingOlder,
    olderError,
    send,
    retry,
    peerState,
    keyChanged: sawKeyChange || changedNow,
    acceptKeyChange,
    status,
    error: matchQuery.error ?? messagesQuery.error ?? (peerProblem === 'error' ? peerQuery.error : null),
    refresh,
    refreshing: messagesQuery.isRefetching,
    evidence,
  }
}

export type Conversation = ReturnType<typeof useConversationAs>
