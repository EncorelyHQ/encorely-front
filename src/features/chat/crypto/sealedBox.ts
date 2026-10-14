import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'

import { concat, utf8, type RandomBytes } from './bytes'
import { E2eeError } from './errors'

const LINK_INFO = utf8('ENCORELY-LINK-v1')
const NONCE_LENGTH = 24

export interface SealedToKey {
  senderEphemeralKey: Uint8Array
  nonce: Uint8Array
  ciphertext: Uint8Array
}

function sharedKey(secret: Uint8Array, peerPublic: Uint8Array, senderPublic: Uint8Array, recipientPublic: Uint8Array) {
  let shared: Uint8Array
  try {
    shared = x25519.getSharedSecret(secret, peerPublic)
  } catch {
    throw new E2eeError('invalid_key')
  }
  let acc = 0
  for (const byte of shared) acc |= byte
  if (acc === 0) throw new E2eeError('invalid_key')
  // Las dos públicas en el salt: la llave queda atada a este par y no a cualquiera con el mismo secreto.
  const key = hkdf(sha256, shared, concat(senderPublic, recipientPublic), LINK_INFO, 32)
  shared.fill(0)
  return key
}

/**
 * Cifra hacia una X25519 pública con una efímera de un solo uso (ECIES: X25519 + HKDF + XChaCha20-Poly1305).
 * `context` va como AAD (p. ej. el id del buzón), para que el sobre no sirva en otro buzón.
 */
export function sealToPublicKey(
  recipientPublic: Uint8Array,
  plaintext: Uint8Array,
  context: Uint8Array,
  random: RandomBytes = randomBytes,
): SealedToKey {
  if (recipientPublic.length !== 32) throw new E2eeError('invalid_key')
  const ephemeralSecret = random(32)
  const senderEphemeralKey = x25519.getPublicKey(ephemeralSecret)
  try {
    const key = sharedKey(ephemeralSecret, recipientPublic, senderEphemeralKey, recipientPublic)
    const nonce = random(NONCE_LENGTH)
    const ciphertext = xchacha20poly1305(key, nonce, concat(LINK_INFO, context)).encrypt(plaintext)
    key.fill(0)
    return { senderEphemeralKey, nonce, ciphertext }
  } finally {
    ephemeralSecret.fill(0)
  }
}

export function openFromPublicKey(
  recipientSecret: Uint8Array,
  recipientPublic: Uint8Array,
  sealed: SealedToKey,
  context: Uint8Array,
): Uint8Array {
  if (sealed.senderEphemeralKey.length !== 32 || sealed.nonce.length !== NONCE_LENGTH) {
    throw new E2eeError('malformed')
  }
  const key = sharedKey(recipientSecret, sealed.senderEphemeralKey, sealed.senderEphemeralKey, recipientPublic)
  try {
    return xchacha20poly1305(key, sealed.nonce, concat(LINK_INFO, context)).decrypt(sealed.ciphertext)
  } catch {
    throw new E2eeError('aead_failed')
  } finally {
    key.fill(0)
  }
}
