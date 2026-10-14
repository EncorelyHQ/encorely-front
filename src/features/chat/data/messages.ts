import type { StoredMessage } from '@/lib/api/types'
import type { MessageKind } from '../crypto'

export const PAGE_SIZE = 50
export const SYNC_PAGE_SIZE = 100
export const MAX_MESSAGE_LENGTH = 2000
// El contrato no define qué devuelve la lista sin cursor; `before` con el máximo trae la página más reciente (desc).
export const LATEST_CURSOR = Number.MAX_SAFE_INTEGER

export type MessageStatus = 'sending' | 'sent' | 'failed' | 'undecryptable'

export type ChatMessage = {
  id: string
  // null mientras el mensaje propio no lo confirma el servidor.
  seq: number | null
  senderId: string
  mine: boolean
  // Epoch ms: createdAt del servidor, o la hora local mientras se envía.
  at: number
  status: MessageStatus
  // Texto descifrado: en memoria (cache de React Query) y, si hay historial local, en la base cifrada del teléfono.
  body: string | null
  kind?: MessageKind
  // Solo mensajes recibidos: lo que pide un reporte para probar quién escribió qué (franking).
  evidence?: { plaintext: string; frankingKey: string }
  // Sobre cifrado de un mensaje que no se pudo abrir, para reintentar tras aceptar una llave nueva.
  envelope?: StoredMessage
}

export type ConversationData = {
  messages: ChatMessage[]
  oldestSeq: number | null
  newestSeq: number | null
  hasMore: boolean
  // Hasta qué seq se leyó el servidor (o la base local) sin huecos. No es newestSeq: un envío propio confirmado
  // tiene un seq mayor que mensajes del otro que quizá aún no llegaron, y pedir after=newestSeq se los saltaría.
  syncedSeq: number | null
}

export const emptyConversation: ConversationData = {
  messages: [],
  oldestSeq: null,
  newestSeq: null,
  hasMore: false,
  syncedSeq: null,
}

function preferred(prev: ChatMessage, next: ChatMessage): ChatMessage {
  // Un mensaje ya descifrado no se degrada a "no descifrable" por llegar de nuevo en otra página.
  if (next.status === 'undecryptable' && prev.status !== 'undecryptable') {
    return { ...prev, seq: prev.seq ?? next.seq, at: next.seq !== null ? next.at : prev.at }
  }
  if (next.seq === null && prev.seq !== null) return prev
  return next
}

export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  if (a.seq !== null && b.seq !== null) return a.seq - b.seq
  if (a.seq !== null) return -1
  if (b.seq !== null) return 1
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

// Idempotente por id: el socket, la paginación y la respuesta del POST pueden traer el mismo mensaje.
export function mergeMessages(existing: readonly ChatMessage[], incoming: readonly ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()
  for (const m of existing) byId.set(m.id, m)
  for (const m of incoming) {
    const prev = byId.get(m.id)
    byId.set(m.id, prev ? preferred(prev, m) : m)
  }
  return [...byId.values()].sort(compareMessages)
}

export type PageDirection = 'initial' | 'older' | 'newer'

export function applyPage(
  data: ConversationData,
  incoming: readonly ChatMessage[],
  direction: PageDirection,
  nextCursor: number | null,
): ConversationData {
  const messages = mergeMessages(data.messages, incoming)
  const seqs = messages.map((m) => m.seq).filter((s): s is number => s !== null)
  return {
    messages,
    oldestSeq: seqs.length ? Math.min(...seqs) : null,
    newestSeq: seqs.length ? Math.max(...seqs) : null,
    // Solo la paginación hacia atrás sabe si queda historial; traer lo nuevo no lo cambia.
    hasMore: direction === 'newer' ? data.hasMore : nextCursor !== null,
    // Lo mueve quien sabe hasta dónde leyó (la sincronización), nunca un mensaje suelto.
    syncedSeq: data.syncedSeq,
  }
}

// Mensajes optimistas que aún no están confirmados; si el servidor ya trajo el mismo id, gana el confirmado.
export function withPending(confirmed: readonly ChatMessage[], pending: readonly ChatMessage[]): ChatMessage[] {
  if (pending.length === 0) return confirmed as ChatMessage[]
  const known = new Set(confirmed.map((m) => m.id))
  const extra = pending.filter((m) => !known.has(m.id)).sort((a, b) => a.at - b.at)
  return extra.length ? [...confirmed, ...extra] : (confirmed as ChatMessage[])
}
