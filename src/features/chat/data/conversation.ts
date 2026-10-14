import type { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { isE2eeError } from '../crypto'
import type { ChatTransport } from './deps'
import {
  applyPage,
  emptyConversation,
  LATEST_CURSOR,
  mergeMessages,
  PAGE_SIZE,
  SYNC_PAGE_SIZE,
  type ChatMessage,
  type ConversationData,
} from './messages'
import type { ChatSession } from './session'

// Tope de vueltas al traer lo nuevo: si faltan más, el próximo aviso o el regreso a la app traen el resto.
const MAX_SYNC_ROUNDS = 10

type Ctx = {
  queryClient: QueryClient
  session: ChatSession
  transport: ChatTransport
  matchId: string
  peerUserId: string
}

const read = (ctx: Ctx) => ctx.queryClient.getQueryData<ConversationData>(queryKeys.messages(ctx.matchId))

// queryFn de la conversación. Sin datos: última página. Con datos: solo `after=newestSeq` (lo que avisó el socket,
// o lo perdido en segundo plano). Así un invalidate de cualquier parte de la app nunca reinicia el historial.
export async function syncConversation(ctx: Ctx): Promise<ConversationData> {
  const current = read(ctx)
  if (!current) {
    const page = await ctx.transport.page(ctx.matchId, { before: LATEST_CURSOR }, PAGE_SIZE)
    const opened = await ctx.session.openAll(ctx.matchId, ctx.peerUserId, page.items)
    // Se mezcla con lo que haya llegado mientras tanto (p. ej. la confirmación de un envío).
    return applyPage(read(ctx) ?? emptyConversation, opened, 'initial', page.nextCursor)
  }

  let after = current.newestSeq ?? 0
  const collected: ChatMessage[] = []
  for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
    const page = await ctx.transport.page(ctx.matchId, { after }, SYNC_PAGE_SIZE)
    collected.push(...(await ctx.session.openAll(ctx.matchId, ctx.peerUserId, page.items)))
    if (page.nextCursor === null || page.items.length === 0) break
    after = Math.max(page.nextCursor, ...page.items.map((m) => m.seq))
  }
  return applyPage(read(ctx) ?? current, collected, 'newer', null)
}

export async function loadOlderPage(ctx: Ctx): Promise<void> {
  const current = read(ctx)
  if (!current?.hasMore || current.oldestSeq === null) return
  const page = await ctx.transport.page(ctx.matchId, { before: current.oldestSeq }, PAGE_SIZE)
  const opened = await ctx.session.openAll(ctx.matchId, ctx.peerUserId, page.items)
  ctx.queryClient.setQueryData<ConversationData>(queryKeys.messages(ctx.matchId), (data) =>
    applyPage(data ?? current, opened, 'older', page.nextCursor),
  )
}

// Tras aceptar o verificar una llave nueva, lo que antes no se podía abrir quizá ya sí.
export async function redecryptFailed(ctx: Ctx): Promise<void> {
  const failed = (read(ctx)?.messages ?? []).filter((m) => m.status === 'undecryptable' && m.envelope)
  if (failed.length === 0) return
  const reopened = await ctx.session.openAll(
    ctx.matchId,
    ctx.peerUserId,
    failed.map((m) => m.envelope!),
  )
  ctx.queryClient.setQueryData<ConversationData>(queryKeys.messages(ctx.matchId), (data) =>
    data ? { ...data, messages: mergeMessages(data.messages, reopened) } : data,
  )
}

export function addConfirmed(queryClient: QueryClient, matchId: string, message: ChatMessage): void {
  queryClient.setQueryData<ConversationData>(queryKeys.messages(matchId), (data) =>
    // Si la conversación aún no cargó, el queryFn en curso la trae; meterla aquí la daría por cargada.
    data ? applyPage(data, [message], 'newer', null) : data,
  )
}

const CLOSED_CODES = new Set(['match_not_found', 'match_closed', 'blocked'])

// El match ya no existe para mí (deshecho, bloqueado o nunca fue mío). Para match, mensajes y envío.
export function isClosedError(error: unknown): boolean {
  if (!isApiError(error) || error.kind !== 'http') return false
  if (error.code && CLOSED_CODES.has(error.code)) return true
  return error.status === 404 || error.status === 403
}

export type PeerProblem = 'closed' | 'noKeys' | 'invalid' | 'error'

// En peer-keys un 404 sin más significa que la otra persona aún no publicó llaves (contrato: peer_keys_missing).
export function classifyPeerError(error: unknown): PeerProblem {
  if (isE2eeError(error)) return 'invalid'
  if (!isApiError(error) || error.kind !== 'http') return 'error'
  if (error.code && CLOSED_CODES.has(error.code)) return 'closed'
  if (error.status === 404) return 'noKeys'
  if (error.status === 403) return 'closed'
  return 'error'
}
