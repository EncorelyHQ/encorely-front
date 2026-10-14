import { seededRandom } from '../../crypto/__fixtures__/seededRandom'
import { b64Decode, b64Encode } from '../../crypto/bytes'
import { isE2eeError } from '../../crypto/errors'
import {
  generateBoxKeyPair,
  generateIdentityKeyPair,
  signBoxKey,
  toPublicKeyBundle,
  type KeyPair,
  type PeerKeyBundle,
} from '../../crypto/keyBundle'
import {
  acceptChange,
  createPeerKeyStore,
  evaluatePeerBundle,
  markVerified,
  trustHistoricalBoxKey,
  type PinnedPeer,
} from '../peerKeys'
import { createMemoryKeyValueStore } from '../storage'

const rng = seededRandom('peer-test')
const PEER = 'peer-user'
const ME = 'me-user'

function peerBundle(identity: KeyPair, boxKeyId: number): PeerKeyBundle {
  const box = generateBoxKeyPair(rng)
  return {
    userId: PEER,
    ...toPublicKeyBundle(identity.publicKey, box.publicKey, boxKeyId, signBoxKey(boxKeyId, box.publicKey, identity.secretKey)),
  }
}

const identity1 = generateIdentityKeyPair(rng)
const identity2 = generateIdentityKeyPair(rng)

function pinFirst(): PinnedPeer {
  return evaluatePeerBundle(null, peerBundle(identity1, 1), 1000).pinned
}

describe('evaluatePeerBundle', () => {
  test('first time pins as unverified', () => {
    const result = evaluatePeerBundle(null, peerBundle(identity1, 1), 1000)
    expect(result.event).toBe('first_seen')
    expect(result.pinned.state).toBe('unverified')
    expect(result.pinned.identityKey).toBe(b64Encode(identity1.publicKey))
    expect(result.canSend).toBe(true)
    expect(result.requiresConfirmation).toBe(false)
  })

  test('same identity and key keeps state', () => {
    const pinned = markVerified(pinFirst(), b64Encode(identity1.publicKey))
    const again = peerBundle(identity1, 1)
    const result = evaluatePeerBundle(pinned, again)
    expect(result.event).toBe('unchanged')
    expect(result.pinned.state).toBe('verified')
    expect(result.canSend).toBe(true)
  })

  test('new box key with same identity is a rotation, not a change', () => {
    const pinned = markVerified(pinFirst(), b64Encode(identity1.publicKey))
    const result = evaluatePeerBundle(pinned, peerBundle(identity1, 2))
    expect(result.event).toBe('rotated')
    expect(result.pinned.state).toBe('verified')
    expect(result.pinned.maxBoxKeyId).toBe(2)
    expect(result.canSend).toBe(true)
  })

  test('an older current box key is flagged as stale and not sendable', () => {
    const pinned = evaluatePeerBundle(pinFirst(), peerBundle(identity1, 5)).pinned
    const result = evaluatePeerBundle(pinned, peerBundle(identity1, 3))
    expect(result.staleBoxKey).toBe(true)
    expect(result.canSend).toBe(false)
  })

  test('identity change on an unverified peer warns but allows sending', () => {
    const result = evaluatePeerBundle(pinFirst(), peerBundle(identity2, 2))
    expect(result.event).toBe('identity_changed')
    expect(result.pinned.state).toBe('changed')
    expect(result.pinned.identityKey).toBe(b64Encode(identity1.publicKey))
    expect(result.pinned.pendingIdentityKey).toBe(b64Encode(identity2.publicKey))
    expect(result.requiresConfirmation).toBe(false)
    expect(result.canSend).toBe(true)
  })

  test('identity change after verification requires confirmation', () => {
    const verified = markVerified(pinFirst(), b64Encode(identity1.publicKey))
    const result = evaluatePeerBundle(verified, peerBundle(identity2, 2))
    expect(result.pinned.state).toBe('changed')
    expect(result.pinned.changedFrom).toBe('verified')
    expect(result.requiresConfirmation).toBe(true)
    expect(result.canSend).toBe(false)

    // Still blocked on re-fetch until the user acts.
    const refetch = evaluatePeerBundle(result.pinned, peerBundle(identity2, 3))
    expect(refetch.requiresConfirmation).toBe(true)

    const accepted = acceptChange(refetch.pinned)
    expect(accepted.state).toBe('unverified')
    expect(accepted.identityKey).toBe(b64Encode(identity2.publicKey))
    expect(accepted.previousIdentityKeys).toEqual([b64Encode(identity1.publicKey)])
    const after = evaluatePeerBundle(accepted, peerBundle(identity2, 4))
    expect(after.canSend).toBe(true)
    expect(after.pinned.state).toBe('unverified')
  })

  test('server reverting to the accepted identity clears the pending change', () => {
    const verified = markVerified(pinFirst(), b64Encode(identity1.publicKey))
    const changed = evaluatePeerBundle(verified, peerBundle(identity2, 2)).pinned
    const back = evaluatePeerBundle(changed, peerBundle(identity1, 3))
    expect(back.pinned.state).toBe('verified')
    expect(back.pinned.pendingIdentityKey).toBeUndefined()
  })

  test('invalid signature throws (fail closed)', () => {
    const bundle = peerBundle(identity1, 1)
    const sig = b64Decode(bundle.boxKeySig)
    sig[0] ^= 1
    expect(() => evaluatePeerBundle(null, { ...bundle, boxKeySig: b64Encode(sig) })).toThrow()
  })

  test('bundle for another user is rejected', () => {
    const error = (() => {
      try {
        evaluatePeerBundle(pinFirst(), { ...peerBundle(identity1, 1), userId: 'someone-else' })
      } catch (e) {
        return e
      }
    })()
    expect(isE2eeError(error, 'identity_mismatch')).toBe(true)
  })
})

describe('markVerified / acceptChange', () => {
  test('markVerified requires the identity the user compared', () => {
    expect(() => markVerified(pinFirst(), b64Encode(identity2.publicKey))).toThrow()
  })

  test('verifying the pending identity accepts and verifies at once', () => {
    const changed = evaluatePeerBundle(pinFirst(), peerBundle(identity2, 2)).pinned
    const verified = markVerified(changed, b64Encode(identity2.publicKey))
    expect(verified.state).toBe('verified')
    expect(verified.identityKey).toBe(b64Encode(identity2.publicKey))
  })

  test('cannot verify the old identity while a change is pending', () => {
    const changed = evaluatePeerBundle(pinFirst(), peerBundle(identity2, 2)).pinned
    expect(() => markVerified(changed, b64Encode(identity1.publicKey))).toThrow()
  })

  test('acceptChange without a pending change throws', () => {
    expect(() => acceptChange(pinFirst())).toThrow()
  })
})

describe('trustHistoricalBoxKey', () => {
  test('accepts keys signed by current or previous identities only', () => {
    const changed = evaluatePeerBundle(
      markVerified(pinFirst(), b64Encode(identity1.publicKey)),
      peerBundle(identity2, 2),
    ).pinned
    expect(trustHistoricalBoxKey(changed, peerBundle(identity1, 1))).not.toBeNull()
    // Pending identity of a previously verified peer is not trusted yet.
    expect(trustHistoricalBoxKey(changed, peerBundle(identity2, 2))).toBeNull()
    const accepted = acceptChange(changed)
    expect(trustHistoricalBoxKey(accepted, peerBundle(identity1, 1))).not.toBeNull()
    expect(trustHistoricalBoxKey(accepted, peerBundle(identity2, 2))).not.toBeNull()
    expect(trustHistoricalBoxKey(accepted, peerBundle(generateIdentityKeyPair(rng), 3))).toBeNull()
  })
})

describe('createPeerKeyStore', () => {
  test('persists evaluations per (me, peer)', async () => {
    const kv = createMemoryKeyValueStore()
    const store = createPeerKeyStore(kv)
    const first = await store.evaluate(ME, peerBundle(identity1, 1))
    expect(first.event).toBe('first_seen')
    expect(kv.dump().has(`e2ee_v1_${ME}_peer_${PEER}`)).toBe(true)
    expect(await store.get('other-me', PEER)).toBeNull()

    const verified = await store.markVerified(ME, PEER, b64Encode(identity1.publicKey))
    expect(verified.state).toBe('verified')

    const changed = await store.evaluate(ME, peerBundle(identity2, 2))
    expect(changed.requiresConfirmation).toBe(true)
    expect((await store.get(ME, PEER))!.state).toBe('changed')

    const accepted = await store.acceptChange(ME, PEER)
    expect(accepted.identityKey).toBe(b64Encode(identity2.publicKey))
    await store.remove(ME, PEER)
    expect(await store.get(ME, PEER)).toBeNull()
  })
})
