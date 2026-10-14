import { isApiError } from '@/lib/api/errors'
import type { OutgoingMessage, PeerKeyBundle, StoredMessage } from '@/lib/api/types'
import { deriveChatKey, E2eeError, isE2eeError, keyIdsForOpen, openMessage, sealMessage } from '../crypto'
import { trustHistoricalBoxKey, type PeerKeyEvent, type PinnedPeer } from '../keys'
import type { ChatDeps } from './deps'
import type { ChatMessage } from './messages'

export type PeerSnapshot = {
  userId: string
  pinned: PinnedPeer
  event: PeerKeyEvent
  canSend: boolean
  requiresConfirmation: boolean
  staleBoxKey: boolean
  boxKeyId: number
  boxKey: Uint8Array
  // Identidad que sirve hoy el servidor (puede ser la pendiente de aceptar).
  identityKey: string
}

// El contacto verificado cambió de llave: no se cifra nada hasta que la persona lo revise.
export class SendBlockedError extends Error {
  constructor() {
    super('Peer key change requires confirmation')
    this.name = 'SendBlockedError'
  }
}

export type ChatSession = ReturnType<typeof createChatSession>

// Estado criptográfico en memoria de un usuario: llaves de chat derivadas y llaves públicas del otro ya vistas.
export function createChatSession(deps: ChatDeps, me: string) {
  const chatKeys = new Map<string, Uint8Array>()
  const bundles = new Map<string, PeerKeyBundle>()
  const current = new Map<string, PeerSnapshot>()
  const inflightPeer = new Map<string, Promise<PeerSnapshot>>()

  const bundleKey = (matchId: string, boxKeyId: number) => `${matchId}:${boxKeyId}`
  const chatKeyId = (matchId: string, myKeyId: number, peerKeyId: number) => `${matchId}:${myKeyId}:${peerKeyId}`

  // evaluate, acceptChange y markVerified leen y reescriben el mismo pin: en serie, o una evaluación
  // que empezó antes de aceptar un cambio podría guardar encima el estado viejo.
  let pinQueue: Promise<unknown> = Promise.resolve()
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = pinQueue.then(task, task)
    pinQueue = run.catch(() => undefined)
    return run
  }

  async function fetchPeer(matchId: string): Promise<PeerSnapshot> {
    const bundle = await deps.transport.peerKeys(matchId)
    const ev = await serialized(() => deps.peerKeys.evaluate(me, bundle))
    const snapshot: PeerSnapshot = {
      userId: bundle.userId,
      pinned: ev.pinned,
      event: ev.event,
      canSend: ev.canSend,
      requiresConfirmation: ev.requiresConfirmation,
      staleBoxKey: ev.staleBoxKey,
      boxKeyId: ev.verified.boxKeyId,
      boxKey: ev.verified.boxKey,
      identityKey: bundle.identityKey,
    }
    bundles.set(bundleKey(matchId, bundle.boxKeyId), bundle)
    current.set(matchId, snapshot)
    return snapshot
  }

  // Varias pantallas y el envío pueden pedir las llaves a la vez: una sola petición.
  function refreshPeer(matchId: string): Promise<PeerSnapshot> {
    const running = inflightPeer.get(matchId)
    if (running) return running
    const run = fetchPeer(matchId).finally(() => inflightPeer.delete(matchId))
    inflightPeer.set(matchId, run)
    return run
  }

  function ensurePeer(matchId: string): Promise<PeerSnapshot> {
    const known = current.get(matchId)
    return known ? Promise.resolve(known) : refreshPeer(matchId)
  }

  // Tras acceptChange/markVerified el pin cambió en disco: el snapshot en memoria debe reflejarlo.
  function updatePinned(matchId: string, pinned: PinnedPeer): PeerSnapshot | null {
    const snap = current.get(matchId)
    if (!snap) return null
    const blocked = pinned.state === 'changed' && pinned.changedFrom === 'verified'
    const next: PeerSnapshot = {
      ...snap,
      pinned,
      requiresConfirmation: blocked,
      canSend: !blocked && !snap.staleBoxKey,
    }
    current.set(matchId, next)
    return next
  }

  const acceptChange = (matchId: string, peerUserId: string) =>
    serialized(async () => updatePinned(matchId, await deps.peerKeys.acceptChange(me, peerUserId)))

  const markVerified = (matchId: string, peerUserId: string, identityKey: string) =>
    serialized(async () => updatePinned(matchId, await deps.peerKeys.markVerified(me, peerUserId, identityKey)))

  async function pinnedFor(matchId: string, peerUserId: string): Promise<PinnedPeer> {
    let pinned = await deps.peerKeys.get(me, peerUserId)
    if (!pinned) {
      await ensurePeer(matchId)
      pinned = await deps.peerKeys.get(me, peerUserId)
    }
    if (!pinned) throw new E2eeError('missing_keys')
    return pinned
  }

  async function peerBox(matchId: string, peerUserId: string, boxKeyId: number): Promise<Uint8Array> {
    const pinned = await pinnedFor(matchId, peerUserId)
    let bundle = bundles.get(bundleKey(matchId, boxKeyId))
    if (!bundle) {
      const historical = await deps.transport.peerBox(matchId, boxKeyId)
      bundle = { ...historical, updatedAt: historical.createdAt }
      bundles.set(bundleKey(matchId, boxKeyId), bundle)
    }
    // Se revalida cada vez: si el contacto cambió de identidad y aún no se acepta, sus llaves nuevas no valen.
    const verified = trustHistoricalBoxKey(pinned, bundle)
    if (!verified || verified.boxKeyId !== boxKeyId) throw new E2eeError('identity_mismatch')
    return verified.boxKey
  }

  async function chatKeyFor(matchId: string, peerUserId: string, myKeyId: number, peerKeyId: number) {
    const id = chatKeyId(matchId, myKeyId, peerKeyId)
    const cached = chatKeys.get(id)
    if (cached) return cached
    const mySecret = await deps.deviceKeys.getBoxSecret(me, myKeyId)
    if (!mySecret) throw new E2eeError('missing_keys')
    try {
      const key = deriveChatKey(mySecret, await peerBox(matchId, peerUserId, peerKeyId), matchId)
      chatKeys.set(id, key)
      return key
    } finally {
      mySecret.fill(0)
    }
  }

  async function open(matchId: string, peerUserId: string, item: StoredMessage): Promise<ChatMessage> {
    const mine = item.senderId === me
    const base = {
      id: item.id,
      seq: item.seq,
      senderId: item.senderId,
      mine,
      at: Date.parse(item.createdAt),
    }
    try {
      const ids = keyIdsForOpen(item, item.senderId, me)
      const chatKey = await chatKeyFor(matchId, peerUserId, ids.myBoxKeyId, ids.peerBoxKeyId)
      const opened = openMessage(
        { ...item, frankingTag: item.frankingTag ?? undefined },
        { chatKey, matchId, senderId: item.senderId, recipientId: mine ? peerUserId : me },
      )
      return {
        ...base,
        status: 'sent',
        body: opened.body,
        kind: opened.kind,
        evidence: mine ? undefined : { plaintext: opened.p, frankingKey: opened.fk },
      }
    } catch (error) {
      // Un corte de red no vuelve ilegible un mensaje: se propaga y la carga se reintenta.
      const unreadable = isE2eeError(error) || (isApiError(error) && error.status === 404)
      if (!unreadable) throw error
      return { ...base, status: 'undecryptable', body: null, envelope: item }
    }
  }

  async function openAll(matchId: string, peerUserId: string, items: readonly StoredMessage[]) {
    const out: ChatMessage[] = []
    for (const item of items) out.push(await open(matchId, peerUserId, item))
    return out
  }

  async function seal(
    matchId: string,
    peerUserId: string,
    msg: { id: string; body: string; sentAt: number },
  ): Promise<OutgoingMessage> {
    const peer = await ensurePeer(matchId)
    if (peer.userId !== peerUserId) throw new E2eeError('identity_mismatch')
    if (!peer.canSend) throw new SendBlockedError()
    const mine = await deps.deviceKeys.currentBoxKey(me)
    if (!mine) throw new E2eeError('missing_keys')
    try {
      const id = chatKeyId(matchId, mine.keyId, peer.boxKeyId)
      let chatKey = chatKeys.get(id)
      if (!chatKey) {
        chatKey = deriveChatKey(mine.secretKey, peer.boxKey, matchId)
        chatKeys.set(id, chatKey)
      }
      const envelope = sealMessage({
        chatKey,
        id: msg.id,
        matchId,
        senderId: me,
        recipientId: peerUserId,
        sentAt: msg.sentAt,
        kind: 'text',
        body: msg.body,
        senderBoxKeyId: mine.keyId,
        recipientBoxKeyId: peer.boxKeyId,
      })
      return { ...envelope, frankingTag: envelope.frankingTag ?? null }
    } finally {
      mine.secretKey.fill(0)
    }
  }

  function clear() {
    for (const key of chatKeys.values()) key.fill(0)
    chatKeys.clear()
    bundles.clear()
    current.clear()
  }

  return {
    me,
    fetchPeer: refreshPeer,
    ensurePeer,
    peer: (matchId: string) => current.get(matchId) ?? null,
    acceptChange,
    markVerified,
    open,
    openAll,
    seal,
    clear,
  }
}

const registry = new Map<ChatDeps, Map<string, ChatSession>>()

export function getChatSession(deps: ChatDeps, me: string): ChatSession {
  let byUser = registry.get(deps)
  if (!byUser) {
    byUser = new Map()
    registry.set(deps, byUser)
  }
  let session = byUser.get(me)
  if (!session) {
    session = createChatSession(deps, me)
    byUser.set(me, session)
  }
  return session
}

// Al cerrar sesión se borran de memoria las llaves derivadas (las de largo plazo siguen en el llavero).
export function clearChatSessions(): void {
  for (const byUser of registry.values()) for (const session of byUser.values()) session.clear()
  registry.clear()
}
