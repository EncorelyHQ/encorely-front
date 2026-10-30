import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'

import { utf8 } from './bytes'
import { E2eeError } from './errors'

const CHAT_KDF_INFO = utf8('ENCORELY-CHAT-v1')

/**
 * Symmetric per-(match, box key pair) key. Both peers derive the same value, and the
 * sender can re-derive it to read its own history. Callers may cache it keyed by
 * (matchId, myBoxKeyId, peerBoxKeyId).
 */
export function deriveChatKey(mySecret: Uint8Array, peerBoxPublic: Uint8Array, matchId: string): Uint8Array {
  if (mySecret.length !== 32 || peerBoxPublic.length !== 32 || !matchId) {
    throw new E2eeError('invalid_key')
  }
  let shared: Uint8Array
  try {
    shared = x25519.getSharedSecret(mySecret, peerBoxPublic)
  } catch {
    throw new E2eeError('invalid_key')
  }
  // noble already rejects low-order points; this keeps the guarantee explicit and library-independent.
  let acc = 0
  for (const byte of shared) acc |= byte
  if (acc === 0) throw new E2eeError('invalid_key')

  const key = hkdf(sha256, shared, utf8(matchId), CHAT_KDF_INFO, 32)
  shared.fill(0)
  return key
}
