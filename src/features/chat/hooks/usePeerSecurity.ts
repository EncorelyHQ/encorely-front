import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { useUser } from '@/lib/session/SessionContext'
import { b64Decode, safetyCode, safetyQrPayload, verifySafetyQr, type SafetyParty } from '../crypto'
import { useChatDeps } from '../data/ChatDepsContext'
import { classifyPeerError, isClosedError, redecryptFailed } from '../data/conversation'
import { ensureKeysPublished } from '../data/publishKeys'
import { getChatSession, type PeerSnapshot } from '../data/session'
import { useMatch, usePeerKeys } from './useChatQueries'

// Clave local (no es estado de servidor): mi llave de identidad pública, para calcular el código de seguridad.
const identityKey = (me: string) => ['e2ee', 'identity', me] as const

export function usePeerSecurity(matchId: string) {
  const { id: me } = useUser()
  const deps = useChatDeps()
  const queryClient = useQueryClient()
  const session = getChatSession(deps, me)

  const matchQuery = useMatch(matchId)
  const match = matchQuery.data
  const peerUserId = match?.peer.id
  const closed = match?.status === 'closed' || (matchQuery.isError && isClosedError(matchQuery.error))
  const peerQuery = usePeerKeys(matchId, me, !!peerUserId && !closed)

  const myIdentity = useQuery({
    queryKey: identityKey(me),
    queryFn: async () => {
      const existing = await deps.deviceKeys.identityPublicKey(me)
      if (existing) return existing
      await ensureKeysPublished(deps, me)
      return deps.deviceKeys.identityPublicKey(me)
    },
    staleTime: Infinity,
    structuralSharing: false,
  })

  const pinned = peerQuery.data?.pinned
  // Mientras hay un cambio pendiente se muestra el código NUEVO: es el que hay que comparar en persona.
  const shownIdentity = pinned ? (pinned.pendingIdentityKey ?? pinned.identityKey) : null

  const parties = useMemo((): { me: SafetyParty; peer: SafetyParty } | null => {
    if (!myIdentity.data || !shownIdentity || !peerUserId) return null
    try {
      return {
        me: { userId: me, identityKey: myIdentity.data },
        peer: { userId: peerUserId, identityKey: b64Decode(shownIdentity) },
      }
    } catch {
      // Una llave mal codificada ya habría fallado la verificación de firma; aquí solo no hay código que mostrar.
      return null
    }
  }, [me, myIdentity.data, peerUserId, shownIdentity])

  const code = useMemo(() => (parties ? safetyCode(parties.me, parties.peer) : null), [parties])
  const qrPayload = useMemo(() => (parties ? safetyQrPayload(parties.me, parties.peer) : null), [parties])

  const afterTrustChange = useCallback(
    async (snapshot: PeerSnapshot | null) => {
      if (snapshot) queryClient.setQueryData(queryKeys.peerKeys(matchId), snapshot)
      else void queryClient.invalidateQueries({ queryKey: queryKeys.peerKeys(matchId), exact: true })
      if (peerUserId) {
        await redecryptFailed({
          queryClient,
          session,
          transport: deps.transport,
          matchId,
          peerUserId,
          local: deps.local,
          now: deps.now,
        })
      }
    },
    [deps.transport, deps.local, deps.now, matchId, peerUserId, queryClient, session],
  )

  // Se verifica exactamente la llave cuyo código se mostró: si cambia mientras se compara, markVerified falla.
  const markVerified = useCallback(async () => {
    if (!peerUserId || !shownIdentity) return
    await afterTrustChange(await session.markVerified(matchId, peerUserId, shownIdentity))
  }, [afterTrustChange, matchId, peerUserId, session, shownIdentity])

  const acceptChange = useCallback(async () => {
    if (!peerUserId) return
    await afterTrustChange(await session.acceptChange(matchId, peerUserId))
  }, [afterTrustChange, matchId, peerUserId, session])

  const checkScanned = useCallback(
    (data: string) => (parties ? verifySafetyQr(data, parties.me, parties.peer) : false),
    [parties],
  )

  const peerProblem = peerQuery.error && !peerQuery.data ? classifyPeerError(peerQuery.error) : null

  return {
    match,
    trust: pinned?.state ?? null,
    changedFrom: pinned?.changedFrom,
    code,
    qrPayload,
    loading: matchQuery.isPending || peerQuery.isPending || myIdentity.isPending,
    peerProblem: closed ? ('closed' as const) : peerProblem,
    error: matchQuery.error ?? peerQuery.error ?? myIdentity.error,
    retry: () => {
      void matchQuery.refetch()
      void peerQuery.refetch()
      void myIdentity.refetch()
    },
    markVerified,
    acceptChange,
    checkScanned,
  }
}
