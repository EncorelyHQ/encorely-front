import type { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { isE2eeError } from '../crypto'
import type { LocalStores } from '../local/registry'
import type { LocalChatStore } from '../local/types'
import type { ChatTransport } from './deps'
import { fromLocal, IMPORT_MAX_ROUNDS, pullToLocal, storeMessages } from './localSync'
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

export type ConversationCtx = {
  queryClient: QueryClient
  session: ChatSession
  transport: ChatTransport
  matchId: string
  peerUserId: string
  local?: LocalStores
  now: () => number
}

type Ctx = ConversationCtx

const read = (ctx: Ctx) => ctx.queryClient.getQueryData<ConversationData>(queryKeys.messages(ctx.matchId))
const write = (ctx: Ctx, update: (data: ConversationData | undefined) => ConversationData | undefined) =>
  ctx.queryClient.setQueryData<ConversationData>(queryKeys.messages(ctx.matchId), update)

// Sin base local (no abrió, o tests de v1) todo sale del servidor como antes.
const localStore = (ctx: Ctx): Promise<LocalChatStore | null> =>
  ctx.local ? ctx.local.get(ctx.session.me) : Promise.resolve(null)

// queryFn de la conversación. Sin datos: última página. Con datos: solo lo posterior a `syncedSeq` (lo que avisó el
// socket, o lo perdido en segundo plano). Así un invalidate de cualquier parte de la app nunca reinicia el historial.
export async function syncConversation(ctx: Ctx): Promise<ConversationData> {
  const store = await localStore(ctx)
  return store ? syncFromLocal(ctx, store) : syncFromServer(ctx)
}

async function syncFromServer(ctx: Ctx): Promise<ConversationData> {
  const current = read(ctx)
  if (!current) {
    const page = await ctx.transport.page(ctx.matchId, { before: LATEST_CURSOR }, PAGE_SIZE)
    const opened = await ctx.session.openAll(ctx.matchId, ctx.peerUserId, page.items)
    const newest = page.items.length ? Math.max(...page.items.map((m) => m.seq)) : null
    // Se mezcla con lo que haya llegado mientras tanto (p. ej. la confirmación de un envío).
    const data = applyPage(read(ctx) ?? emptyConversation, opened, 'initial', page.nextCursor)
    return { ...data, syncedSeq: newest }
  }

  let after = current.syncedSeq ?? 0
  const collected: ChatMessage[] = []
  for (let round = 0; round < MAX_SYNC_ROUNDS; round++) {
    const page = await ctx.transport.page(ctx.matchId, { after }, SYNC_PAGE_SIZE)
    collected.push(...(await ctx.session.openAll(ctx.matchId, ctx.peerUserId, page.items)))
    if (page.items.length > 0) after = Math.max(after, page.nextCursor ?? 0, ...page.items.map((m) => m.seq))
    if (page.nextCursor === null || page.items.length === 0) break
  }
  const latest = read(ctx) ?? current
  return { ...applyPage(latest, collected, 'newer', null), syncedSeq: Math.max(latest.syncedSeq ?? 0, after) }
}

// Con historial local: primero se trae lo nuevo del servidor a la base (y se confirma), luego la pantalla lee de
// la base. Sin red se sigue leyendo lo guardado.
async function syncFromLocal(ctx: Ctx, store: LocalChatStore): Promise<ConversationData> {
  const current = read(ctx)
  const known = await store.syncState(ctx.matchId)
  let pullError: unknown = null
  try {
    await pullToLocal({
      session: ctx.session,
      transport: ctx.transport,
      store,
      matchId: ctx.matchId,
      peerUserId: ctx.peerUserId,
      now: ctx.now(),
      maxRounds: known ? MAX_SYNC_ROUNDS : IMPORT_MAX_ROUNDS,
    })
  } catch (error) {
    pullError = error
  }
  if (pullError && (isClosedError(pullError) || current)) throw pullError

  const synced = (await store.syncState(ctx.matchId))?.syncedSeq ?? 0
  if (!current) {
    const rows = await store.latest(ctx.matchId, PAGE_SIZE + 1)
    if (pullError && rows.length === 0) throw pullError
    const opened = rows.slice(-PAGE_SIZE).map((row) => fromLocal(row, ctx.session.me))
    // nextCursor solo indica si quedan más viejos en la base.
    const data = applyPage(read(ctx) ?? emptyConversation, opened, 'initial', rows.length > PAGE_SIZE ? 1 : null)
    return { ...data, syncedSeq: synced }
  }

  // Lo posterior a lo último que vio la pantalla, venga de esta sincronización o de una en segundo plano.
  const rows = await store.after(ctx.matchId, current.syncedSeq ?? 0)
  const latest = read(ctx) ?? current
  const fresh = rows.map((row) => fromLocal(row, ctx.session.me))
  return { ...applyPage(latest, fresh, 'newer', null), syncedSeq: Math.max(latest.syncedSeq ?? 0, synced) }
}

export async function loadOlderPage(ctx: Ctx): Promise<void> {
  const current = read(ctx)
  if (!current?.hasMore || current.oldestSeq === null) return
  const store = await localStore(ctx)
  if (store) {
    const rows = await store.before(ctx.matchId, current.oldestSeq, PAGE_SIZE + 1)
    const older = rows.slice(-PAGE_SIZE).map((row) => fromLocal(row, ctx.session.me))
    write(ctx, (data) => applyPage(data ?? current, older, 'older', rows.length > PAGE_SIZE ? 1 : null))
    return
  }
  const page = await ctx.transport.page(ctx.matchId, { before: current.oldestSeq }, PAGE_SIZE)
  const opened = await ctx.session.openAll(ctx.matchId, ctx.peerUserId, page.items)
  write(ctx, (data) => applyPage(data ?? current, opened, 'older', page.nextCursor))
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
  const store = await localStore(ctx)
  if (store) await storeMessages(store, ctx.matchId, reopened)
  write(ctx, (data) => (data ? { ...data, messages: mergeMessages(data.messages, reopened) } : data))
}

export function addConfirmed(queryClient: QueryClient, matchId: string, message: ChatMessage): void {
  queryClient.setQueryData<ConversationData>(queryKeys.messages(matchId), (data) =>
    // Si la conversación aún no cargó, el queryFn en curso la trae; meterla aquí la daría por cargada.
    data ? applyPage(data, [message], 'newer', null) : data,
  )
}

// El servidor guarda lo que envío solo hasta que el otro lo confirma: mi copia legible vive en la base local.
export async function persistSent(ctx: Ctx, message: ChatMessage): Promise<void> {
  const store = await localStore(ctx)
  if (store) await storeMessages(store, ctx.matchId, [message])
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
