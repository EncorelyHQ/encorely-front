import { seededRandom } from '../../crypto/__fixtures__/seededRandom'
import { openMessage, sealMessage } from '../../crypto/envelope'
import { isE2eeError } from '../../crypto/errors'
import { verifyBoxKey } from '../../crypto/keyBundle'
import { createDeviceKeys } from '../deviceKeys'
import { createMemoryKeyValueStore, createMemorySecretStore } from '../storage'

const USER = '11111111-2222-4333-8444-555555555555'

function setup(seed = 'device-test') {
  const secure = createMemorySecretStore()
  const kv = createMemoryKeyValueStore()
  const keys = createDeviceKeys({ secure, kv, randomBytes: seededRandom(seed) })
  return { secure, kv, keys }
}

describe('deviceKeys', () => {
  test('generates on first run with keyId = server + 1, signed and stored namespaced', async () => {
    const { secure, kv, keys } = setup()
    const result = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: 4 })
    expect(result.created).toBe(true)
    expect(result.needsUpload).toBe(true)
    expect(result.bundle.boxKeyId).toBe(5)
    expect(verifyBoxKey(result.bundle).boxKeyId).toBe(5)
    for (const key of secure.dump().keys()) {
      expect(key).toMatch(new RegExp(`^e2ee_v1_${USER}_`))
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/)
    }
    expect(kv.dump().get(`e2ee_v1_${USER}_install_id`)).toBeTruthy()
    expect(await keys.publicBundle(USER)).toEqual(result.bundle)
  })

  test('first run with no server keys starts at 1', async () => {
    const { keys } = setup()
    expect((await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })).bundle.boxKeyId).toBe(1)
  })

  test('is idempotent when the server matches', async () => {
    const { keys } = setup()
    const first = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const second = await keys.ensureDeviceKeys(USER, {
      serverCurrentBoxKeyId: first.bundle.boxKeyId,
      serverIdentityKey: first.bundle.identityKey,
      serverBoxKey: first.bundle.boxKey,
    })
    expect(second).toEqual({ bundle: first.bundle, created: false, rotated: false, needsUpload: false })
  })

  test('re-uploads without rotating when the upload never landed', async () => {
    const { keys } = setup()
    const first = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const again = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    expect(again).toMatchObject({ created: false, rotated: false, needsUpload: true })
    expect(again.bundle).toEqual(first.bundle)
  })

  test('rotates above the server when the server is ahead', async () => {
    const { keys } = setup()
    const first = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const again = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: 9 })
    expect(again).toMatchObject({ created: false, rotated: true, needsUpload: true })
    expect(again.bundle.boxKeyId).toBe(10)
    expect(again.bundle.identityKey).toBe(first.bundle.identityKey)
  })

  test('concurrent ensure calls produce a single identity', async () => {
    const { keys } = setup()
    const [a, b] = await Promise.all([
      keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null }),
      keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null }),
    ])
    expect(a.bundle.identityKey).toBe(b.bundle.identityKey)
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1)
  })

  test('rotation keeps old secrets, raises keyId and old history still decrypts', async () => {
    const { keys } = setup()
    const peer = setup('peer')
    const mine = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const theirs = await peer.keys.ensureDeviceKeys('peer-user', { serverCurrentBoxKeyId: null })
    const theirBox = verifyBoxKey(theirs.bundle).boxKey

    const oldSecret = (await keys.getBoxSecret(USER, mine.bundle.boxKeyId))!
    const envelope = sealMessage({
      id: '2b3c4d5e-6f70-4a1b-9c2d-3e4f5a6b7c8d',
      matchId: 'match',
      senderId: 'peer-user',
      recipientId: USER,
      sentAt: 1,
      kind: 'text',
      body: 'old',
      senderBoxKeyId: theirs.bundle.boxKeyId,
      recipientBoxKeyId: mine.bundle.boxKeyId,
      mySecret: (await peer.keys.getBoxSecret('peer-user', theirs.bundle.boxKeyId))!,
      peerBoxPublic: verifyBoxKey(mine.bundle).boxKey,
    })

    const rotated = await keys.rotateBoxKey(USER, mine.bundle.boxKeyId)
    expect(rotated.boxKeyId).toBe(mine.bundle.boxKeyId + 1)
    expect(rotated.identityKey).toBe(mine.bundle.identityKey)
    expect(rotated.boxKey).not.toBe(mine.bundle.boxKey)
    expect(verifyBoxKey(rotated).boxKeyId).toBe(rotated.boxKeyId)
    expect(await keys.listBoxKeyIds(USER)).toEqual([mine.bundle.boxKeyId, rotated.boxKeyId])
    expect((await keys.currentBoxKey(USER))!.keyId).toBe(rotated.boxKeyId)

    const kept = await keys.getBoxSecret(USER, envelope.recipientBoxKeyId)
    expect(kept).toEqual(oldSecret)
    const opened = openMessage(envelope, {
      matchId: 'match',
      senderId: 'peer-user',
      recipientId: USER,
      mySecret: kept!,
      peerBoxPublic: theirBox,
    })
    expect(opened.body).toBe('old')
  })

  test('rotateBoxKey uses max(local, server) + 1', async () => {
    const { keys } = setup()
    await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    expect((await keys.rotateBoxKey(USER, 20)).boxKeyId).toBe(21)
    expect((await keys.rotateBoxKey(USER, 3)).boxKeyId).toBe(22)
  })

  test('pruneBoxKeys drops old secrets but never the current one', async () => {
    const { secure, keys } = setup()
    await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    await keys.rotateBoxKey(USER, null)
    await keys.rotateBoxKey(USER, null)
    expect(await keys.pruneBoxKeys(USER, [2])).toEqual([1])
    expect(await keys.listBoxKeyIds(USER)).toEqual([2, 3])
    expect(await keys.getBoxSecret(USER, 1)).toBeNull()
    expect(secure.dump().has(`e2ee_v1_${USER}_box_1`)).toBe(false)
    expect(await keys.pruneBoxKeys(USER, [])).toEqual([2])
    expect(await keys.listBoxKeyIds(USER)).toEqual([3])
  })

  test('treats keychain leftovers without the install flag as a fresh install (iOS reinstall)', async () => {
    const { secure, kv, keys } = setup()
    const before = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    kv.dump().clear()
    const after = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: before.bundle.boxKeyId })
    expect(after.created).toBe(true)
    expect(after.bundle.identityKey).not.toBe(before.bundle.identityKey)
    expect(after.bundle.boxKeyId).toBe(before.bundle.boxKeyId + 1)
    expect(secure.dump().has(`e2ee_v1_${USER}_box_${before.bundle.boxKeyId}`)).toBe(false)
  })

  test('getters return null before keys exist', async () => {
    const { keys } = setup()
    expect(await keys.publicBundle(USER)).toBeNull()
    expect(await keys.currentBoxKey(USER)).toBeNull()
    expect(await keys.getBoxSecret(USER, 1)).toBeNull()
    const error = await keys.rotateBoxKey(USER, null).catch((e: unknown) => e)
    expect(isE2eeError(error, 'missing_keys')).toBe(true)
  })

  test('wipe removes every secret and the flag', async () => {
    const { secure, kv, keys } = setup()
    await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    await keys.rotateBoxKey(USER, null)
    await keys.wipeDeviceKeys(USER)
    expect(secure.dump().size).toBe(0)
    expect(kv.dump().size).toBe(0)
    expect(await keys.publicBundle(USER)).toBeNull()
  })

  test('users are isolated', async () => {
    const { keys } = setup()
    const a = await keys.ensureDeviceKeys('user-a', { serverCurrentBoxKeyId: null })
    const b = await keys.ensureDeviceKeys('user-b', { serverCurrentBoxKeyId: null })
    expect(a.bundle.identityKey).not.toBe(b.bundle.identityKey)
    await keys.wipeDeviceKeys('user-a')
    expect(await keys.publicBundle('user-b')).toEqual(b.bundle)
  })

  test('rejects ids that are not valid SecureStore key segments', async () => {
    const { keys } = setup()
    await expect(keys.ensureDeviceKeys('a/b', { serverCurrentBoxKeyId: null })).rejects.toThrow()
  })
})
