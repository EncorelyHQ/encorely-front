import { seededRandom } from '../__fixtures__/seededRandom'
import { b64Decode, b64Encode } from '../bytes'
import { isE2eeError } from '../errors'
import {
  generateBoxKeyPair,
  generateIdentityKeyPair,
  signBoxKey,
  toPublicKeyBundle,
  verifyBoxKey,
  type PublicKeyBundle,
} from '../keyBundle'

const rng = seededRandom('bundle-test')
const identity = generateIdentityKeyPair(rng)
const box = generateBoxKeyPair(rng)

function bundle(keyId = 4): PublicKeyBundle {
  return toPublicKeyBundle(identity.publicKey, box.publicKey, keyId, signBoxKey(keyId, box.publicKey, identity.secretKey))
}

function expectInvalid(b: PublicKeyBundle) {
  try {
    verifyBoxKey(b)
  } catch (error) {
    expect(isE2eeError(error)).toBe(true)
    return
  }
  throw new Error('expected verifyBoxKey to throw')
}

describe('box key signature', () => {
  test('valid bundle verifies', () => {
    const verified = verifyBoxKey(bundle())
    expect(verified.boxKeyId).toBe(4)
    expect(verified.boxKey).toEqual(box.publicKey)
    expect(verified.identityKey).toEqual(identity.publicKey)
  })

  test('keyId is bound by the signature', () => {
    expectInvalid({ ...bundle(4), boxKeyId: 5 })
  })

  test('swapped box key fails', () => {
    const other = generateBoxKeyPair(rng)
    expectInvalid({ ...bundle(), boxKey: b64Encode(other.publicKey) })
  })

  test('signature by another identity fails', () => {
    const mallory = generateIdentityKeyPair(rng)
    expectInvalid({ ...bundle(), identityKey: b64Encode(mallory.publicKey) })
  })

  test('flipped signature bit fails', () => {
    const b = bundle()
    const sig = b64Decode(b.boxKeySig)
    sig[10] ^= 1
    expectInvalid({ ...b, boxKeySig: b64Encode(sig) })
  })

  test('malformed fields fail', () => {
    expectInvalid({ ...bundle(), identityKey: 'nope' })
    expectInvalid({ ...bundle(), boxKeySig: b64Encode(new Uint8Array(63)) })
    expectInvalid({ ...bundle(), boxKeyId: 0 })
    expectInvalid({ ...bundle(), boxKeyId: 1.5 })
  })
})
