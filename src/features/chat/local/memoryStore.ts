import type { LocalChatStore, LocalMessage, LocalStoreProvider, SyncState } from './types'

const bySeq = (a: LocalMessage, b: LocalMessage) => a.seq - b.seq

// Misma semántica que la tabla SQLite (upsert sin degradar, keyset por seq, estado monótono) para probar la
// lógica de sincronización en Jest sin el módulo nativo.
export function createMemoryChatStore(): LocalChatStore & { dump(): Map<string, LocalMessage> } {
  const rows = new Map<string, LocalMessage>()
  const states = new Map<string, SyncState>()

  const forMatch = (matchId: string) => [...rows.values()].filter((m) => m.matchId === matchId).sort(bySeq)

  return {
    async upsert(messages) {
      for (const message of messages) {
        const prev = rows.get(message.id)
        if (prev && prev.status === 'sent' && message.status === 'undecryptable') continue
        // Un envío propio guardado al confirmarse no tiene p/fk; si luego llega del servidor, se conserva lo que haya.
        rows.set(message.id, prev ? { ...message, p: message.p ?? prev.p, fk: message.fk ?? prev.fk } : { ...message })
      }
    },
    async latest(matchId, limit) {
      return forMatch(matchId).slice(-limit)
    },
    async before(matchId, seq, limit) {
      return forMatch(matchId)
        .filter((m) => m.seq < seq)
        .slice(-limit)
    },
    async after(matchId, seq) {
      return forMatch(matchId).filter((m) => m.seq > seq)
    },
    async undecryptable(matchId) {
      return [...rows.values()]
        .filter((m) => m.status === 'undecryptable' && (matchId === undefined || m.matchId === matchId))
        .sort(bySeq)
    },
    async syncState(matchId) {
      const state = states.get(matchId)
      return state ? { ...state } : null
    },
    async saveSyncState(state) {
      const prev = states.get(state.matchId)
      states.set(state.matchId, {
        matchId: state.matchId,
        syncedSeq: Math.max(prev?.syncedSeq ?? 0, state.syncedSeq),
        ackedSeq: Math.max(prev?.ackedSeq ?? 0, state.ackedSeq),
        completedAt: Math.max(prev?.completedAt ?? 0, state.completedAt ?? 0) || null,
      })
    },
    async allSyncStates() {
      return [...states.values()].map((s) => ({ ...s }))
    },
    async exportAll() {
      return [...rows.values()].sort((a, b) => (a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : a.seq - b.seq))
    },
    async stats() {
      let approxBytes = 0
      for (const m of rows.values()) approxBytes += JSON.stringify(m).length
      return { messages: rows.size, approxBytes }
    },
    async close() {},
    dump: () => rows,
  }
}

export function createMemoryStoreProvider(): LocalStoreProvider & { stores: Map<string, ReturnType<typeof createMemoryChatStore>> } {
  const stores = new Map<string, ReturnType<typeof createMemoryChatStore>>()
  return {
    stores,
    async open(userId) {
      let store = stores.get(userId)
      if (!store) {
        store = createMemoryChatStore()
        stores.set(userId, store)
      }
      return store
    },
    async wipe(userId) {
      stores.delete(userId)
    },
  }
}
