import { generateBoxKeyPair, generateIdentityKeyPair, signBoxKey, toPublicKeyBundle } from '../../crypto/keyBundle'
import { seededRandom } from '../../crypto/__fixtures__/seededRandom'
import { createPeerKeyStore } from '../peerKeys'
import { createMemoryKeyValueStore } from '../storage'

const ME = 'me-user'
const OTHER_ME = 'other-account'

function bundleFor(userId: string, seed: string) {
  const random = seededRandom(seed)
  const identity = generateIdentityKeyPair(random)
  const box = generateBoxKeyPair(random)
  const sig = signBoxKey(1, box.publicKey, identity.secretKey)
  return { ...toPublicKeyBundle(identity.publicKey, box.publicKey, 1, sig), userId }
}

describe('peerKeys.wipeAll', () => {
  test('borra todos los pines del usuario (y su índice) sin tocar los de otra cuenta', async () => {
    const kv = createMemoryKeyValueStore()
    const store = createPeerKeyStore(kv)
    await store.evaluate(ME, bundleFor('peer-1', 'p1'))
    await store.evaluate(ME, bundleFor('peer-2', 'p2'))
    await store.evaluate(OTHER_ME, bundleFor('peer-1', 'p1'))
    expect(JSON.parse(kv.dump().get(`e2ee_v1_${ME}_peers`)!)).toEqual(['peer-1', 'peer-2'])

    await store.wipeAll(ME)
    expect(await store.get(ME, 'peer-1')).toBeNull()
    expect(await store.get(ME, 'peer-2')).toBeNull()
    expect([...kv.dump().keys()].filter((k) => k.startsWith(`e2ee_v1_${ME}_`))).toEqual([])
    expect(await store.get(OTHER_ME, 'peer-1')).not.toBeNull()
  })

  test('también borra pines guardados antes de que existiera el índice', async () => {
    const kv = createMemoryKeyValueStore()
    const store = createPeerKeyStore(kv)
    await store.evaluate(ME, bundleFor('peer-1', 'p1'))
    // Pin escrito por la versión anterior: está en el almacén pero no en el índice.
    kv.dump().set(`e2ee_v1_${ME}_peer_legacy`, kv.dump().get(`e2ee_v1_${ME}_peer_peer-1`)!)
    await store.wipeAll(ME)
    expect([...kv.dump().keys()].filter((k) => k.startsWith(`e2ee_v1_${ME}_`))).toEqual([])
  })

  test('remove saca al contacto del índice; pines simultáneos no se pisan el índice', async () => {
    const kv = createMemoryKeyValueStore()
    const store = createPeerKeyStore(kv)
    await Promise.all(['a', 'b', 'c'].map((id) => store.evaluate(ME, bundleFor(id, id))))
    expect(JSON.parse(kv.dump().get(`e2ee_v1_${ME}_peers`)!).sort()).toEqual(['a', 'b', 'c'])
    await store.remove(ME, 'b')
    expect(JSON.parse(kv.dump().get(`e2ee_v1_${ME}_peers`)!).sort()).toEqual(['a', 'c'])
  })
})
