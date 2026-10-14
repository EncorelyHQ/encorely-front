import { x25519 } from '@noble/curves/ed25519.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'

import { seededRandom } from '../__fixtures__/seededRandom'
import { b64Encode, utf8 } from '../bytes'
import { boxKeyPairFromChain, newChainSeed, nextChainKey } from '../boxChain'
import { isE2eeError } from '../errors'

const seed = () => newChainSeed(seededRandom('chain'))

describe('boxChain', () => {
  test('sigue la fórmula acordada con el back (HKDF-SHA256 con infos separadas)', () => {
    const chain = seed()
    expect(nextChainKey(chain)).toEqual(hkdf(sha256, chain, undefined, utf8('ENCORELY-BOXCHAIN-v1'), 32))
    const box = boxKeyPairFromChain(chain)
    expect(box.secretKey).toEqual(hkdf(sha256, chain, undefined, utf8('ENCORELY-BOXKEY-v1'), 32))
    expect(box.publicKey).toEqual(x25519.getPublicKey(box.secretKey))
  })

  test('es determinista: la misma semilla da la misma cadena y las mismas cajas', () => {
    const walk = (start: Uint8Array, steps: number) => {
      const out: string[] = []
      let chain = start
      for (let i = 0; i < steps; i++) {
        out.push(b64Encode(boxKeyPairFromChain(chain).publicKey))
        chain = nextChainKey(chain)
      }
      return out
    }
    expect(walk(seed(), 5)).toEqual(walk(seed(), 5))
    expect(new Set(walk(seed(), 5)).size).toBe(5)
  })

  test('es de una vía: de chain_n no se llega a chain_{n-1} ni a su caja', () => {
    const c0 = seed()
    const c1 = nextChainKey(c0)
    const box0 = b64Encode(boxKeyPairFromChain(c0).secretKey)
    const seen = new Set<string>()
    let chain = c1
    // Avanzar desde chain_1 nunca vuelve a chain_0 ni a su caja: la única dirección posible es hacia adelante.
    for (let i = 0; i < 64; i++) {
      seen.add(b64Encode(chain))
      seen.add(b64Encode(boxKeyPairFromChain(chain).secretKey))
      chain = nextChainKey(chain)
    }
    expect(seen.has(b64Encode(c0))).toBe(false)
    expect(seen.has(box0)).toBe(false)
    // Y la caja no es el siguiente eslabón: filtrar una caja no revela la cadena.
    expect(boxKeyPairFromChain(c0).secretKey).not.toEqual(c1)
  })

  test('rechaza cadenas de largo incorrecto', () => {
    expect(() => nextChainKey(new Uint8Array(31))).toThrow()
    let error: unknown = null
    try {
      boxKeyPairFromChain(new Uint8Array(33))
    } catch (e) {
      error = e
    }
    expect(isE2eeError(error, 'invalid_key')).toBe(true)
  })
})
