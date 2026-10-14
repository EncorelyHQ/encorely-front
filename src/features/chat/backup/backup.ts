import { randomBytes } from '@noble/hashes/utils.js'
import { isApiError } from '@/lib/api/errors'
import type { BackupBlob, BackupInfo, PutBackupRequest } from '@/lib/api/endpoints'
import {
  b64Decode,
  b64Encode,
  decryptBackup,
  DEFAULT_SCRYPT,
  deriveBackupKey,
  E2eeError,
  encryptBackup,
  fromWireKdf,
  newBackupSalt,
  toWireKdf,
  utf8,
  utf8Decode,
  type RandomBytes,
} from '../crypto'
import type { KeyMaterial } from '../keys'
import type { LocalMessage } from '../local/types'
import type { ChatDeps } from '../data/deps'
import { ensureKeysPublished, forgetPublishedKeys } from '../data/publishKeys'
import { clearChatSessions } from '../data/session'

export type BackupTransport = {
  info: () => Promise<BackupInfo>
  get: () => Promise<BackupBlob>
  put: (body: PutBackupRequest) => Promise<BackupInfo>
  remove: () => Promise<unknown>
}

// Tope del contrato para el ciphertext (10 MiB) menos el tag de Poly1305.
export const MAX_BACKUP_PLAINTEXT = 10 * 1024 * 1024 - 16

export class BackupTooLargeError extends Error {
  constructor() {
    super('Backup exceeds 10 MiB')
    this.name = 'BackupTooLargeError'
  }
}

// [id, matchId, seq, senderId, sentAt, kind, body, p, fk, status, envelope]. Si hay `p` (recibidos), el texto ya
// va adentro y `body` se omite: el historial pesa casi la mitad.
type CompactRow = [string, string, number, string, number, string, string | null, string | null, string | null, string, string | null]

type BackupPayload = {
  v: 1
  userId: string
  createdAt: number
  keys: KeyMaterial
  history: CompactRow[] | null
}

function compact(m: LocalMessage): CompactRow {
  return [m.id, m.matchId, m.seq, m.senderId, m.sentAt, m.kind, m.p ? null : m.body, m.p, m.fk, m.status, m.envelope]
}

function bodyFromInner(p: string): string | null {
  try {
    const inner = JSON.parse(p) as { b?: unknown }
    return typeof inner.b === 'string' ? inner.b : null
  } catch {
    return null
  }
}

function expand(row: CompactRow): LocalMessage | null {
  if (!Array.isArray(row) || row.length !== 11) return null
  const [id, matchId, seq, senderId, sentAt, kind, body, p, fk, status, envelope] = row
  if (typeof id !== 'string' || typeof matchId !== 'string' || typeof senderId !== 'string') return null
  if (!Number.isSafeInteger(seq) || !Number.isSafeInteger(sentAt)) return null
  const undecryptable = status === 'undecryptable'
  return {
    id,
    matchId,
    seq,
    senderId,
    sentAt,
    kind: kind === 'system' ? 'system' : 'text',
    body: undecryptable ? null : (body ?? (p ? bodyFromInner(p) : null)),
    p,
    fk,
    status: undecryptable ? 'undecryptable' : 'sent',
    envelope,
  }
}

export type BackupEstimate = { messages: number; approxBytes: number; fits: boolean }

/** Tamaño aproximado del historial para avisar antes de incluirlo. */
export async function estimateHistory(deps: ChatDeps, me: string): Promise<BackupEstimate | null> {
  const store = deps.local ? await deps.local.get(me) : null
  if (!store) return null
  const stats = await store.stats()
  return { ...stats, fits: stats.approxBytes < MAX_BACKUP_PLAINTEXT }
}

type CreateArgs = {
  deps: ChatDeps
  me: string
  passphrase: string
  includeHistory: boolean
  transport: BackupTransport
  onProgress?: (progress: number) => void
  random?: RandomBytes
}

/** Cifra en el teléfono (scrypt → XChaCha20-Poly1305) y sube el blob. El servidor nunca ve la frase. */
export async function createBackup(args: CreateArgs): Promise<BackupInfo> {
  const random = args.random ?? randomBytes
  const keys = await args.deps.deviceKeys.exportMaterial(args.me)
  let history: CompactRow[] | null = null
  if (args.includeHistory) {
    const store = args.deps.local ? await args.deps.local.get(args.me) : null
    history = store ? (await store.exportAll()).map(compact) : []
  }
  const payload: BackupPayload = { v: 1, userId: args.me, createdAt: args.deps.now(), keys, history }
  const plaintext = utf8(JSON.stringify(payload))
  if (plaintext.length > MAX_BACKUP_PLAINTEXT) throw new BackupTooLargeError()

  const salt = newBackupSalt(random)
  const kdf = toWireKdf(DEFAULT_SCRYPT)
  const key = await deriveBackupKey(args.passphrase, salt, DEFAULT_SCRYPT, args.onProgress)
  try {
    const sealed = encryptBackup(key, plaintext, kdf, salt, random)
    return await args.transport.put({
      version: sealed.version,
      ciphertext: b64Encode(sealed.ciphertext),
      nonce: b64Encode(sealed.nonce),
      salt: b64Encode(sealed.salt),
      kdf: sealed.kdf,
    })
  } finally {
    key.fill(0)
    plaintext.fill(0)
  }
}

export type RestoreResult = { messages: number }

type RestoreArgs = {
  deps: ChatDeps
  me: string
  passphrase: string
  transport: BackupTransport
  onProgress?: (progress: number) => void
}

function parsePayload(bytes: Uint8Array): BackupPayload {
  let value: Partial<BackupPayload>
  try {
    value = JSON.parse(utf8Decode(bytes)) as Partial<BackupPayload>
  } catch {
    throw new E2eeError('malformed')
  }
  if (!value || value.v !== 1 || typeof value.userId !== 'string' || !value.keys) throw new E2eeError('malformed')
  if (value.history !== null && value.history !== undefined && !Array.isArray(value.history)) {
    throw new E2eeError('malformed')
  }
  return value as BackupPayload
}

/**
 * Descarga, descifra con la frase (equivocada → E2eeError 'aead_failed'), instala llaves y cadena, publica una caja
 * nueva por encima de la del servidor e importa el historial a la base local.
 */
export async function restoreBackup(args: RestoreArgs): Promise<RestoreResult> {
  const blob = await args.transport.get()
  const params = fromWireKdf(blob.kdf)
  const sealed = {
    version: blob.version,
    kdf: blob.kdf,
    salt: b64Decode(blob.salt),
    nonce: b64Decode(blob.nonce),
    ciphertext: b64Decode(blob.ciphertext),
  }
  const key = await deriveBackupKey(args.passphrase, sealed.salt, params, args.onProgress)
  let plaintext: Uint8Array
  try {
    plaintext = decryptBackup(key, sealed)
  } finally {
    key.fill(0)
  }
  let payload: BackupPayload
  try {
    payload = parsePayload(plaintext)
  } finally {
    plaintext.fill(0)
  }
  // Un respaldo de otra cuenta no se instala aunque la frase coincida.
  if (payload.userId !== args.me) throw new E2eeError('identity_mismatch')

  await args.deps.deviceKeys.importMaterial(args.me, payload.keys)
  // Las llaves derivadas en memoria y la marca de "ya publiqué" eran de las llaves anteriores.
  clearChatSessions()
  forgetPublishedKeys()
  await ensureKeysPublished(args.deps, args.me, true)

  const rows = (payload.history ?? []).map(expand).filter((m): m is LocalMessage => m !== null)
  const store = args.deps.local ? await args.deps.local.get(args.me) : null
  if (store && rows.length > 0) await store.upsert(rows)
  return { messages: store ? rows.length : 0 }
}

/** null si todavía no hay respaldo (404 backup_missing). */
export async function backupInfo(transport: BackupTransport): Promise<BackupInfo | null> {
  try {
    return await transport.info()
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null
    throw error
  }
}

