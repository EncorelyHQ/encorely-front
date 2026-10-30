import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'

import { utf8, type RandomBytes } from './bytes'
import { E2eeError } from './errors'
import type { KeyPair } from './keyBundle'

// Diseño acordado con el back. Dos infos distintas sobre el mismo chain_n: la caja nunca sirve para
// calcular el siguiente eslabón, y del siguiente no se vuelve al anterior (HKDF es de una vía).
const CHAIN_INFO = utf8('ENCORELY-BOXCHAIN-v1')
const BOX_INFO = utf8('ENCORELY-BOXKEY-v1')
const CHAIN_LENGTH = 32

function assertChain(chain: Uint8Array): void {
  if (!(chain instanceof Uint8Array) || chain.length !== CHAIN_LENGTH) throw new E2eeError('invalid_key')
}

/** Semilla de una cadena nueva (primera rotación de una instalación v1, o instalación nueva). */
export function newChainSeed(random: RandomBytes = randomBytes): Uint8Array {
  return random(CHAIN_LENGTH)
}

/** chain_{n+1} = HKDF-SHA256(chain_n, info 'ENCORELY-BOXCHAIN-v1'). */
export function nextChainKey(chain: Uint8Array): Uint8Array {
  assertChain(chain)
  return hkdf(sha256, chain, undefined, CHAIN_INFO, CHAIN_LENGTH)
}

/** box_priv_n = HKDF-SHA256(chain_n, info 'ENCORELY-BOXKEY-v1'); noble aplica el clamp de X25519. */
export function boxKeyPairFromChain(chain: Uint8Array): KeyPair {
  assertChain(chain)
  const secretKey = hkdf(sha256, chain, undefined, BOX_INFO, 32)
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) }
}
