import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { scryptAsync } from '@noble/hashes/scrypt.js'
import { randomBytes } from '@noble/hashes/utils.js'

import { concat, u32be, u8, utf8, type RandomBytes } from './bytes'
import { E2eeError } from './errors'

export const BACKUP_FORMAT_VERSION = 1
const BACKUP_CONTEXT = utf8('ENCORELY-BACKUP-v1')
const SALT_LENGTH = 16
const NONCE_LENGTH = 24

/**
 * scrypt y no argon2id: medido con @noble/hashes 2.4 en un intérprete sin JIT (como Hermes), argon2id con el
 * mínimo de OWASP (19 MiB, t=2) tardó ~9 s y con 64 MiB/t=3 pasaría de 30 s; scrypt N=2^15, r=8 (32 MiB) tardó
 * ~11 s y se puede correr en trozos sin congelar la UI (scryptAsync). Los parámetros viajan con el respaldo, así
 * que se pueden subir más adelante sin romper los respaldos viejos.
 */
export const DEFAULT_SCRYPT = { N: 2 ** 15, r: 8, p: 1 } as const

export type ScryptParams = { N: number; r: number; p: number }

/** Forma del contrato (`KdfParams`). Para scrypt: opsLimit = N, memLimit = 128·r·N bytes; p = 1 en el formato v1. */
export type WireKdf = { algorithm: string; opsLimit: number; memLimit: number }

export function toWireKdf(params: ScryptParams = DEFAULT_SCRYPT): WireKdf {
  return { algorithm: 'scrypt', opsLimit: params.N, memLimit: 128 * params.r * params.N }
}

// Acota lo que llega del servidor: un N gigante sería una forma barata de colgar el teléfono.
export function fromWireKdf(kdf: WireKdf): ScryptParams {
  if (!kdf || kdf.algorithm !== 'scrypt') throw new E2eeError('unsupported_version')
  const N = kdf.opsLimit
  if (!Number.isInteger(N) || N < 2 ** 14 || N > 2 ** 20 || (N & (N - 1)) !== 0) throw new E2eeError('invalid_input')
  const r = kdf.memLimit / (128 * N)
  if (!Number.isInteger(r) || r < 1 || r > 32) throw new E2eeError('invalid_input')
  return { N, r, p: 1 }
}

/** Misma frase escrita en otro teclado o con espacios de más debe dar la misma llave. */
export function normalizePassphrase(passphrase: string): string {
  const collapsed = passphrase.trim().replace(/\s+/g, ' ')
  return typeof collapsed.normalize === 'function' ? collapsed.normalize('NFC') : collapsed
}

export async function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array,
  params: ScryptParams,
  onProgress?: (progress: number) => void,
): Promise<Uint8Array> {
  return scryptAsync(utf8(normalizePassphrase(passphrase)), salt, {
    ...params,
    dkLen: 32,
    // Cede el hilo cada 8 ms: la pantalla sigue respondiendo mientras deriva.
    asyncTick: 8,
    onProgress,
  })
}

function backupAad(version: number, kdf: WireKdf, salt: Uint8Array): Uint8Array {
  // Los parámetros y la sal quedan autenticados: si alguien los cambia en el servidor, descifrar falla.
  return concat(BACKUP_CONTEXT, u8(version), utf8(kdf.algorithm), Uint8Array.of(0), u32be(kdf.opsLimit), u32be(kdf.memLimit), salt)
}

export interface SealedBackup {
  version: number
  kdf: WireKdf
  salt: Uint8Array
  nonce: Uint8Array
  ciphertext: Uint8Array
}

export function newBackupSalt(random: RandomBytes = randomBytes): Uint8Array {
  return random(SALT_LENGTH)
}

export function encryptBackup(
  key: Uint8Array,
  plaintext: Uint8Array,
  kdf: WireKdf,
  salt: Uint8Array,
  random: RandomBytes = randomBytes,
): SealedBackup {
  if (key.length !== 32) throw new E2eeError('invalid_key')
  const nonce = random(NONCE_LENGTH)
  const ciphertext = xchacha20poly1305(key, nonce, backupAad(BACKUP_FORMAT_VERSION, kdf, salt)).encrypt(plaintext)
  return { version: BACKUP_FORMAT_VERSION, kdf, salt, nonce, ciphertext }
}

/** Frase equivocada o respaldo alterado: E2eeError('aead_failed'). */
export function decryptBackup(key: Uint8Array, sealed: SealedBackup): Uint8Array {
  if (sealed.version !== BACKUP_FORMAT_VERSION) throw new E2eeError('unsupported_version')
  if (sealed.nonce.length !== NONCE_LENGTH) throw new E2eeError('malformed')
  try {
    return xchacha20poly1305(key, sealed.nonce, backupAad(sealed.version, sealed.kdf, sealed.salt)).decrypt(
      sealed.ciphertext,
    )
  } catch {
    throw new E2eeError('aead_failed')
  }
}
