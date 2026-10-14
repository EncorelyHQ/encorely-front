import type { LocalChatStore } from '../local/types'
import type { ChatDeps } from './deps'
import { IMPORT_MAX_ROUNDS, parseEnvelope, pullToLocal } from './localSync'
import { ensureKeysPublished, publishBundle, serverKeys } from './publishKeys'
import { getChatSession } from './session'

export const ROTATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export type MaintenanceResult = { rotated: boolean; pruned: number[] }

/** Rota la caja (siguiente eslabón de la cadena), la firma y la publica. */
export async function rotateAndPublish(deps: ChatDeps, me: string): Promise<void> {
  const server = await serverKeys(deps)
  const bundle = await deps.deviceKeys.rotateBoxKey(me, server?.boxKeyId ?? null)
  await publishBundle(deps, me, bundle)
}

/**
 * Borra las cajas privadas viejas solo cuando ya no hacen falta: el servidor confirmó la caja vigente (desde
 * entonces nadie puede cifrar a las anteriores), cada match se sincronizó completo DESPUÉS de esa confirmación,
 * todo quedó guardado en la base local y el servidor confirmó el ack. Lo que no se pudo abrir conserva su llave.
 * Si algo falla a mitad, no se borra nada.
 */
export async function pruneRetiredKeys(deps: ChatDeps, me: string, store: LocalChatStore): Promise<number[]> {
  const status = await deps.deviceKeys.keyStatus(me)
  if (!status || status.keyIds.length <= 1 || status.publishedAt === null) return []
  const retiredAt = status.publishedAt

  const session = getChatSession(deps, me)
  for (const match of await deps.transport.matches()) {
    // Un match cerrado ya no entrega mensajes (404): lo que no se trajo antes no se puede leer con ninguna llave.
    if (match.status !== 'active') continue
    const state = await store.syncState(match.id)
    const fresh = state?.completedAt != null && state.completedAt >= retiredAt && state.ackedSeq >= state.syncedSeq
    if (fresh) continue
    const result = await pullToLocal({
      session,
      transport: deps.transport,
      store,
      matchId: match.id,
      peerUserId: match.peer.id,
      now: deps.now(),
      maxRounds: IMPORT_MAX_ROUNDS,
    })
    if (!result.complete || result.state.ackedSeq < result.state.syncedSeq) return []
  }

  const keep: number[] = []
  for (const row of await store.undecryptable()) {
    const envelope = parseEnvelope(row.envelope)
    if (envelope) keep.push(row.senderId === me ? envelope.senderBoxKeyId : envelope.recipientBoxKeyId)
  }
  return deps.deviceKeys.pruneBoxKeys(me, keep)
}

/**
 * Al arrancar y al volver a la app: publicar llaves, rotar cada 7 días y borrar las viejas ya innecesarias.
 * Sin base local no se rota: borrar llaves sin tener los mensajes guardados los volvería ilegibles.
 */
export async function runKeyMaintenance(deps: ChatDeps, me: string): Promise<MaintenanceResult> {
  await ensureKeysPublished(deps, me)
  const store = deps.local ? await deps.local.get(me) : null
  if (!store) return { rotated: false, pruned: [] }

  let rotated = false
  if (await deps.deviceKeys.rotationDue(me, ROTATION_INTERVAL_MS)) {
    await rotateAndPublish(deps, me)
    rotated = true
  }
  return { rotated, pruned: await pruneRetiredKeys(deps, me, store) }
}

const running = new Map<ChatDeps, Map<string, Promise<MaintenanceResult>>>()

// Arranque y "volver a la app" pueden coincidir: una sola pasada a la vez por usuario.
export function scheduleKeyMaintenance(deps: ChatDeps, me: string): Promise<MaintenanceResult> {
  let byUser = running.get(deps)
  if (!byUser) {
    byUser = new Map()
    running.set(deps, byUser)
  }
  const existing = byUser.get(me)
  if (existing) return existing
  const run = runKeyMaintenance(deps, me).finally(() => byUser.delete(me))
  byUser.set(me, run)
  return run
}
