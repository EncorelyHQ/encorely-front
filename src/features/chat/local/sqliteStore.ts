import * as SQLite from 'expo-sqlite'
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js'

import { b64Decode, b64Encode } from '../crypto/bytes'
import { assertSafeKeySegment, type SecretStore } from '../keys/storage'
import type { LocalChatStore, LocalMessage, LocalStoreProvider, SyncState } from './types'

// Capa delgada sobre expo-sqlite (compilado con SQLCipher, ver app.json). La lógica vive en data/localSync y se
// prueba contra el store en memoria con la misma semántica.

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS messages (
     id TEXT PRIMARY KEY NOT NULL,
     match_id TEXT NOT NULL,
     seq INTEGER NOT NULL,
     sender_id TEXT NOT NULL,
     sent_at INTEGER NOT NULL,
     kind TEXT NOT NULL,
     body TEXT,
     p TEXT,
     fk TEXT,
     status TEXT NOT NULL,
     envelope TEXT
   );
   CREATE INDEX IF NOT EXISTS messages_match_seq ON messages (match_id, seq);
   CREATE INDEX IF NOT EXISTS messages_undecryptable ON messages (match_id) WHERE status = 'undecryptable';
   CREATE TABLE IF NOT EXISTS sync_state (
     match_id TEXT PRIMARY KEY NOT NULL,
     synced_seq INTEGER NOT NULL,
     acked_seq INTEGER NOT NULL,
     completed_at INTEGER
   );`,
]

type Row = {
  id: string
  match_id: string
  seq: number
  sender_id: string
  sent_at: number
  kind: string
  body: string | null
  p: string | null
  fk: string | null
  status: string
  envelope: string | null
}

type StateRow = { match_id: string; synced_seq: number; acked_seq: number; completed_at: number | null }

const toMessage = (r: Row): LocalMessage => ({
  id: r.id,
  matchId: r.match_id,
  seq: r.seq,
  senderId: r.sender_id,
  sentAt: r.sent_at,
  kind: r.kind === 'system' ? 'system' : 'text',
  body: r.body,
  p: r.p,
  fk: r.fk,
  status: r.status === 'undecryptable' ? 'undecryptable' : 'sent',
  envelope: r.envelope,
})

const toState = (r: StateRow): SyncState => ({
  matchId: r.match_id,
  syncedSeq: r.synced_seq,
  ackedSeq: r.acked_seq,
  completedAt: r.completed_at,
})

const UPSERT = `INSERT INTO messages (id, match_id, seq, sender_id, sent_at, kind, body, p, fk, status, envelope)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    seq = excluded.seq, sender_id = excluded.sender_id, sent_at = excluded.sent_at, kind = excluded.kind,
    body = excluded.body, p = COALESCE(excluded.p, messages.p), fk = COALESCE(excluded.fk, messages.fk),
    status = excluded.status, envelope = excluded.envelope
  WHERE NOT (messages.status = 'sent' AND excluded.status = 'undecryptable')`

function wrap(db: SQLite.SQLiteDatabase, onClose: () => void): LocalChatStore {
  return {
    async upsert(messages) {
      if (messages.length === 0) return
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const m of messages) {
          await txn.runAsync(UPSERT, [
            m.id,
            m.matchId,
            m.seq,
            m.senderId,
            m.sentAt,
            m.kind,
            m.body,
            m.p,
            m.fk,
            m.status,
            m.envelope,
          ])
        }
      })
    },
    async latest(matchId, limit) {
      const rows = await db.getAllAsync<Row>(
        'SELECT * FROM messages WHERE match_id = ? ORDER BY seq DESC LIMIT ?',
        [matchId, limit],
      )
      return rows.reverse().map(toMessage)
    },
    async before(matchId, seq, limit) {
      const rows = await db.getAllAsync<Row>(
        'SELECT * FROM messages WHERE match_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?',
        [matchId, seq, limit],
      )
      return rows.reverse().map(toMessage)
    },
    async after(matchId, seq) {
      const rows = await db.getAllAsync<Row>('SELECT * FROM messages WHERE match_id = ? AND seq > ? ORDER BY seq', [
        matchId,
        seq,
      ])
      return rows.map(toMessage)
    },
    async undecryptable(matchId) {
      const rows =
        matchId === undefined
          ? await db.getAllAsync<Row>("SELECT * FROM messages WHERE status = 'undecryptable' ORDER BY seq")
          : await db.getAllAsync<Row>(
              "SELECT * FROM messages WHERE match_id = ? AND status = 'undecryptable' ORDER BY seq",
              [matchId],
            )
      return rows.map(toMessage)
    },
    async syncState(matchId) {
      const row = await db.getFirstAsync<StateRow>('SELECT * FROM sync_state WHERE match_id = ?', [matchId])
      return row ? toState(row) : null
    },
    async saveSyncState(s) {
      await db.runAsync(
        `INSERT INTO sync_state (match_id, synced_seq, acked_seq, completed_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (match_id) DO UPDATE SET
           synced_seq = MAX(synced_seq, excluded.synced_seq),
           acked_seq = MAX(acked_seq, excluded.acked_seq),
           completed_at = MAX(COALESCE(completed_at, 0), COALESCE(excluded.completed_at, 0))`,
        [s.matchId, s.syncedSeq, s.ackedSeq, s.completedAt],
      )
    },
    async allSyncStates() {
      return (await db.getAllAsync<StateRow>('SELECT * FROM sync_state')).map(toState)
    },
    async exportAll() {
      return (await db.getAllAsync<Row>('SELECT * FROM messages ORDER BY match_id, seq')).map(toMessage)
    },
    async stats() {
      const row = await db.getFirstAsync<{ n: number; bytes: number | null }>(
        `SELECT count(*) AS n, sum(length(id) + length(match_id) + length(sender_id) + length(COALESCE(body, ''))
           + length(COALESCE(p, '')) + length(COALESCE(fk, '')) + length(COALESCE(envelope, '')) + 80) AS bytes
         FROM messages`,
      )
      return { messages: row?.n ?? 0, approxBytes: row?.bytes ?? 0 }
    },
    async close() {
      onClose()
      await db.closeAsync()
    },
  }
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
  let version = row?.user_version ?? 0
  while (version < MIGRATIONS.length) {
    await db.execAsync(MIGRATIONS[version])
    version += 1
    await db.execAsync(`PRAGMA user_version = ${version}`)
  }
}

/**
 * Base por usuario cifrada con SQLCipher. La llave es de 32 B aleatorios en SecureStore
 * (WHEN_UNLOCKED_THIS_DEVICE_ONLY), se pasa en crudo (x'…', sin el PBKDF2 de SQLCipher) y nunca sale del teléfono.
 */
export function createSqliteStoreProvider(secure: SecretStore): LocalStoreProvider {
  const names = (userId: string) => {
    assertSafeKeySegment(userId)
    return { file: `encorely_chat_${userId}.db`, key: `e2ee_v1_${userId}_dbkey` }
  }
  const open = new Map<string, SQLite.SQLiteDatabase>()

  async function openWith(file: string, key: Uint8Array): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(file)
    try {
      await db.execAsync(`PRAGMA key = "x'${bytesToHex(key)}'"`)
      // Con la llave equivocada SQLCipher no falla en PRAGMA key sino en la primera lectura.
      await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master')
      await migrate(db)
      return db
    } catch (error) {
      await db.closeAsync().catch(() => undefined)
      throw error
    }
  }

  return {
    async open(userId) {
      const { file, key: keyName } = names(userId)
      const forget = () => open.delete(userId)
      const existing = open.get(userId)
      if (existing) return wrap(existing, forget)

      // Si leer el llavero falla (p. ej. teléfono bloqueado) se propaga: crear otra llave dejaría la base ilegible.
      const stored = await secure.getItem(keyName)
      if (stored !== null) {
        const key = b64Decode(stored)
        try {
          const db = await openWith(file, key)
          open.set(userId, db)
          return wrap(db, forget)
        } catch {
          // Llave presente pero la base no abre con ella: dañada o de otra instalación. Ilegible: se rehace abajo.
        } finally {
          key.fill(0)
        }
      }

      const fresh = randomBytes(32)
      try {
        // Sin llave guardada, una base vieja en disco (llavero borrado) es ilegible: se empieza de cero.
        await SQLite.deleteDatabaseAsync(file).catch(() => undefined)
        await secure.setItem(keyName, b64Encode(fresh))
        const db = await openWith(file, fresh)
        open.set(userId, db)
        return wrap(db, forget)
      } finally {
        fresh.fill(0)
      }
    },
    async wipe(userId) {
      const { file, key } = names(userId)
      const db = open.get(userId)
      open.delete(userId)
      if (db) await db.closeAsync()
      // Puede no existir (nunca se abrió en este teléfono); lo que importa es que tampoco quede la llave.
      await SQLite.deleteDatabaseAsync(file).catch(() => undefined)
      await secure.deleteItem(key)
    },
  }
}
