import { isApiError } from '@/lib/api/errors'
import type { KeyBundle, PeerKeyBundle } from '@/lib/api/types'
import type { ChatDeps } from './deps'

export async function serverKeys(deps: ChatDeps): Promise<PeerKeyBundle | null> {
  try {
    return await deps.transport.myKeys()
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
}

// PUT /keys/me. 409 stale_box_key_id: otro teléfono (o una instalación anterior) publicó un id mayor; se rota por
// encima de ese y se reintenta una vez. Al confirmar, se anota cuándo: desde ahí nadie cifra a las cajas viejas.
export async function publishBundle(deps: ChatDeps, me: string, bundle: KeyBundle): Promise<void> {
  let published = bundle
  try {
    await deps.transport.publishKeys(bundle)
  } catch (error) {
    if (!isApiError(error, 'stale_box_key_id')) throw error
    const latest = await serverKeys(deps)
    published = await deps.deviceKeys.rotateBoxKey(me, latest?.boxKeyId ?? null)
    await deps.transport.publishKeys(published)
  }
  await deps.deviceKeys.markPublished(me, published.boxKeyId)
}

// GET /keys/me → ensureDeviceKeys → PUT si hace falta.
async function publish(deps: ChatDeps, me: string): Promise<void> {
  const server = await serverKeys(deps)
  const result = await deps.deviceKeys.ensureDeviceKeys(me, {
    serverCurrentBoxKeyId: server?.boxKeyId ?? null,
    serverIdentityKey: server?.identityKey ?? null,
    serverBoxKey: server?.boxKey ?? null,
  })
  if (result.needsUpload) await publishBundle(deps, me, result.bundle)
  else await deps.deviceKeys.markPublished(me, result.bundle.boxKeyId)
}

const published = new Map<ChatDeps, Map<string, Promise<void>>>()

// Una sola publicación por usuario y arranque; `force` la repite (p. ej. el servidor dijo keys_missing).
export function ensureKeysPublished(deps: ChatDeps, me: string, force = false): Promise<void> {
  let byUser = published.get(deps)
  if (!byUser) {
    byUser = new Map()
    published.set(deps, byUser)
  }
  const existing = byUser.get(me)
  if (existing && !force) return existing
  const run = publish(deps, me)
  byUser.set(me, run)
  run.catch(() => {
    // Falló (sin red, 5xx): se olvida para que el próximo intento vuelva a publicar.
    if (byUser.get(me) === run) byUser.delete(me)
  })
  return run
}

export function forgetPublishedKeys(): void {
  published.clear()
}
