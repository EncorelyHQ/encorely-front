import type { StoredMessage } from '@/lib/api/types'
import type { LocalChatStore, LocalMessage, SyncState } from '../local/types'
import type { ChatTransport } from './deps'
import { SYNC_PAGE_SIZE, type ChatMessage } from './messages'
import type { ChatSession } from './session'

// Primera vez que un match se sincroniza con historial local: se importa todo lo que el servidor aún guarda.
export const IMPORT_MAX_ROUNDS = 50

export function toLocal(matchId: string, m: ChatMessage): LocalMessage | null {
  // Solo lo confirmado por el servidor: un seq es lo único que ordena sin ambigüedad.
  if (m.seq === null || (m.status !== 'sent' && m.status !== 'undecryptable')) return null
  const undecryptable = m.status === 'undecryptable'
  return {
    id: m.id,
    matchId,
    seq: m.seq,
    senderId: m.senderId,
    sentAt: m.at,
    kind: m.kind ?? 'text',
    body: undecryptable ? null : m.body,
    p: m.evidence?.plaintext ?? null,
    fk: m.evidence?.frankingKey ?? null,
    status: undecryptable ? 'undecryptable' : 'sent',
    envelope: undecryptable && m.envelope ? JSON.stringify(m.envelope) : null,
  }
}

export function parseEnvelope(raw: string | null): StoredMessage | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as StoredMessage
    return value && typeof value.id === 'string' && typeof value.ciphertext === 'string' ? value : null
  } catch {
    return null
  }
}

export function fromLocal(row: LocalMessage, me: string): ChatMessage {
  const mine = row.senderId === me
  const envelope = row.status === 'undecryptable' ? parseEnvelope(row.envelope) : null
  return {
    id: row.id,
    seq: row.seq,
    senderId: row.senderId,
    mine,
    at: row.sentAt,
    status: row.status,
    body: row.status === 'sent' ? row.body : null,
    kind: row.kind,
    evidence: !mine && row.p && row.fk ? { plaintext: row.p, frankingKey: row.fk } : undefined,
    envelope: envelope ?? undefined,
  }
}

export function storeMessages(store: LocalChatStore, matchId: string, messages: readonly ChatMessage[]) {
  return store.upsert(messages.map((m) => toLocal(matchId, m)).filter((m): m is LocalMessage => m !== null))
}

export type PullResult = {
  opened: ChatMessage[]
  state: SyncState
  /** Llegó al final de lo que el servidor tenía. */
  complete: boolean
  /** El ack falló (se reintenta en la próxima sincronización); lo recibido ya quedó guardado. */
  ackError: unknown
}

type PullArgs = {
  session: Pick<ChatSession, 'openAll'>
  transport: Pick<ChatTransport, 'page' | 'ack'>
  store: LocalChatStore
  matchId: string
  peerUserId: string
  now: number
  maxRounds: number
}

/**
 * Trae del servidor lo posterior a `syncedSeq`, lo descifra, lo guarda en la base local y solo entonces confirma
 * (POST ack), que hace que el servidor lo borre. Lo que no se pudo abrir se guarda con su sobre para no perderlo.
 */
export async function pullToLocal(args: PullArgs): Promise<PullResult> {
  const { session, transport, store, matchId, peerUserId } = args
  const prev = (await store.syncState(matchId)) ?? { matchId, syncedSeq: 0, ackedSeq: 0, completedAt: null }
  let syncedSeq = prev.syncedSeq
  const opened: ChatMessage[] = []
  let complete = false

  for (let round = 0; round < args.maxRounds; round++) {
    const page = await transport.page(matchId, { after: syncedSeq }, SYNC_PAGE_SIZE)
    const batch = await session.openAll(matchId, peerUserId, page.items)
    // Guardar antes de mover el cursor: si algo se corta aquí, la próxima vuelta lo vuelve a traer (upsert idempotente).
    await storeMessages(store, matchId, batch)
    opened.push(...batch)
    if (page.items.length > 0) syncedSeq = Math.max(syncedSeq, page.nextCursor ?? 0, ...page.items.map((m) => m.seq))
    await store.saveSyncState({ matchId, syncedSeq, ackedSeq: prev.ackedSeq, completedAt: null })
    if (page.nextCursor === null || page.items.length === 0) {
      complete = true
      break
    }
  }

  let ackedSeq = prev.ackedSeq
  let ackError: unknown = null
  if (syncedSeq > ackedSeq) {
    try {
      await transport.ack(matchId, syncedSeq)
      ackedSeq = syncedSeq
    } catch (error) {
      ackError = error
    }
  }
  const state: SyncState = { matchId, syncedSeq, ackedSeq, completedAt: complete ? args.now : prev.completedAt }
  await store.saveSyncState(state)
  return { opened, state, complete, ackError }
}
