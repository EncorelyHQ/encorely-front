import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { randomBytes } from '@noble/hashes/utils.js'

import { b64DecodeLength, b64Encode, concat, u32be, utf8, type RandomBytes } from './bytes'
import { E2eeError } from './errors'

const BOX_KEY_SIG_CONTEXT = utf8('ENCORELY-BOXKEY-v1')
const MAX_BOX_KEY_ID = 0xffffffff

export interface KeyPair {
  secretKey: Uint8Array
  publicKey: Uint8Array
}

/** Wire shape of PUT /keys/me. */
export interface PublicKeyBundle {
  identityKey: string
  boxKey: string
  boxKeyId: number
  boxKeySig: string
}

/** Wire shape of GET /matches/{id}/peer-keys and /peer-keys/box/{boxKeyId}. */
export interface PeerKeyBundle extends PublicKeyBundle {
  userId: string
  updatedAt?: string
}

export interface VerifiedBoxKey {
  identityKey: Uint8Array
  boxKey: Uint8Array
  boxKeyId: number
}

export function isValidBoxKeyId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BOX_KEY_ID
}

export function generateIdentityKeyPair(random: RandomBytes = randomBytes): KeyPair {
  const secretKey = random(32)
  return { secretKey, publicKey: ed25519.getPublicKey(secretKey) }
}

export function generateBoxKeyPair(random: RandomBytes = randomBytes): KeyPair {
  const secretKey = random(32)
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) }
}

function boxKeySigMessage(boxKeyId: number, boxPublic: Uint8Array): Uint8Array {
  return concat(BOX_KEY_SIG_CONTEXT, u32be(boxKeyId), boxPublic)
}

export function signBoxKey(boxKeyId: number, boxPublic: Uint8Array, identitySecret: Uint8Array): Uint8Array {
  if (!isValidBoxKeyId(boxKeyId) || boxPublic.length !== 32) throw new E2eeError('invalid_input')
  return ed25519.sign(boxKeySigMessage(boxKeyId, boxPublic), identitySecret)
}

/**
 * Must run on every peer bundle before use: the server stores keys but never checks them.
 * Only proves the box key belongs to the bundle's own identity; pinning that identity is
 * peerKeys' job.
 */
export function verifyBoxKey(bundle: PublicKeyBundle): VerifiedBoxKey {
  if (!bundle || !isValidBoxKeyId(bundle.boxKeyId)) throw new E2eeError('invalid_key')
  let identityKey: Uint8Array
  let boxKey: Uint8Array
  let sig: Uint8Array
  try {
    identityKey = b64DecodeLength(bundle.identityKey, 32)
    boxKey = b64DecodeLength(bundle.boxKey, 32)
    sig = b64DecodeLength(bundle.boxKeySig, 64)
  } catch {
    throw new E2eeError('invalid_key')
  }

  let valid = false
  try {
    // zip215: false = strict RFC 8032, so one key/signature has exactly one accepted encoding.
    valid = ed25519.verify(sig, boxKeySigMessage(bundle.boxKeyId, boxKey), identityKey, { zip215: false })
  } catch {
    valid = false
  }
  if (!valid) throw new E2eeError('invalid_signature')
  return { identityKey, boxKey, boxKeyId: bundle.boxKeyId }
}

export function toPublicKeyBundle(
  identityPublic: Uint8Array,
  boxPublic: Uint8Array,
  boxKeyId: number,
  boxKeySig: Uint8Array,
): PublicKeyBundle {
  return {
    identityKey: b64Encode(identityPublic),
    boxKey: b64Encode(boxPublic),
    boxKeyId,
    boxKeySig: b64Encode(boxKeySig),
  }
}
