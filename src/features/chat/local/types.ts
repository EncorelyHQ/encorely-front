import type { MessageKind } from '../crypto'

export type LocalStatus = 'sent' | 'undecryptable'

/** Fila del historial local. Vive solo en la base cifrada del teléfono (SQLCipher). */
export type LocalMessage = {
  id: string
  matchId: string
  seq: number
  senderId: string
  /** Epoch ms del servidor (createdAt): la hora que pone el emisor dentro del mensaje no se usa para ordenar. */
  sentAt: number
  kind: MessageKind
  body: string | null
  /** Texto interno exacto y franking key (base64): evidencia para un reporte. Solo mensajes recibidos. */
  p: string | null
  fk: string | null
  status: LocalStatus
  /** Sobre cifrado (JSON) de lo que no se pudo abrir, para reintentar tras aceptar una llave nueva. */
  envelope: string | null
}

export type SyncState = {
  matchId: string
  /** Hasta qué seq se leyó el servidor sin huecos. Mis propios envíos no lo mueven. */
  syncedSeq: number
  /** Hasta qué seq el servidor ya borró lo recibido (ack confirmado). */
  ackedSeq: number
  /** Última vez que una sincronización llegó al final de lo que había en el servidor. */
  completedAt: number | null
}

export type LocalStats = { messages: number; approxBytes: number }

export interface LocalChatStore {
  /** Inserta o actualiza por id. Nunca degrada un mensaje descifrado a "no descifrable". */
  upsert(messages: readonly LocalMessage[]): Promise<void>
  /** Los `limit` más recientes, en orden ascendente de seq. */
  latest(matchId: string, limit: number): Promise<LocalMessage[]>
  /** Keyset: los `limit` anteriores a `seq`, en orden ascendente. */
  before(matchId: string, seq: number, limit: number): Promise<LocalMessage[]>
  /** Todo lo posterior a `seq`, ascendente. */
  after(matchId: string, seq: number): Promise<LocalMessage[]>
  undecryptable(matchId?: string): Promise<LocalMessage[]>
  syncState(matchId: string): Promise<SyncState | null>
  /** Monótono: syncedSeq y ackedSeq solo suben. */
  saveSyncState(state: SyncState): Promise<void>
  allSyncStates(): Promise<SyncState[]>
  /** Recorre todo el historial por páginas (respaldo). */
  exportAll(): Promise<LocalMessage[]>
  stats(): Promise<LocalStats>
  close(): Promise<void>
}

/** Abre (o crea) la base de un usuario y la destruye con su llave al borrar la cuenta. */
export interface LocalStoreProvider {
  open(userId: string): Promise<LocalChatStore>
  wipe(userId: string): Promise<void>
}
