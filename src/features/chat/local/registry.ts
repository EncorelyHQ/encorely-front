import type { LocalChatStore, LocalStoreProvider } from './types'

export type LocalStores = ReturnType<typeof createLocalStores>

/**
 * Una base abierta por usuario y arranque. Si no abre (módulo nativo sin SQLCipher, llavero bloqueado), `get`
 * devuelve null y el chat funciona como en v1: solo servidor, sin ack, sin borrar llaves viejas.
 */
export function createLocalStores(provider: LocalStoreProvider) {
  const opening = new Map<string, Promise<LocalChatStore | null>>()

  function get(userId: string): Promise<LocalChatStore | null> {
    const existing = opening.get(userId)
    if (existing) return existing
    const run = provider.open(userId).catch(() => {
      // Se olvida el fallo para reintentar en el próximo uso (p. ej. al volver con el teléfono desbloqueado).
      if (opening.get(userId) === run) opening.delete(userId)
      return null
    })
    opening.set(userId, run)
    return run
  }

  async function wipe(userId: string): Promise<void> {
    const existing = opening.get(userId)
    opening.delete(userId)
    // Cerrar antes de borrar: con la base abierta el archivo no se puede eliminar.
    const store = existing ? await existing : null
    await store?.close()
    await provider.wipe(userId)
  }

  // Al cerrar sesión: se cierra la conexión, la base y su llave se quedan (como las llaves del chat).
  async function closeAll(): Promise<void> {
    const all = [...opening.values()]
    opening.clear()
    for (const pending of all) await (await pending)?.close()
  }

  return { get, wipe, closeAll }
}
