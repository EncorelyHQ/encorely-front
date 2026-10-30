import { seededRandom } from '../../crypto/__fixtures__/seededRandom'
import { b64Decode, b64Encode } from '../../crypto/bytes'
import { boxKeyPairFromChain, nextChainKey } from '../../crypto/boxChain'
import { isE2eeError } from '../../crypto/errors'
import { verifyBoxKey } from '../../crypto/keyBundle'
import { createDeviceKeys } from '../deviceKeys'
import { createMemoryKeyValueStore, createMemorySecretStore } from '../storage'

const USER = '11111111-2222-4333-8444-555555555555'
const WEEK = 7 * 24 * 60 * 60 * 1000

function setup(seed = 'chain-test') {
  const secure = createMemorySecretStore()
  const kv = createMemoryKeyValueStore()
  let clock = Date.UTC(2026, 9, 1)
  const keys = createDeviceKeys({ secure, kv, randomBytes: seededRandom(seed), now: () => clock })
  return {
    secure,
    kv,
    keys,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

const chainOf = (secure: ReturnType<typeof createMemorySecretStore>) => secure.dump().get(`e2ee_v1_${USER}_chain`)

describe('deviceKeys con cadena', () => {
  test('una instalación nueva arranca con cadena: la caja sale del eslabón guardado', async () => {
    const { secure, keys } = setup()
    const { bundle } = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const chain = b64Decode(chainOf(secure)!)
    expect(b64Encode(boxKeyPairFromChain(chain).publicKey)).toBe(bundle.boxKey)
    expect(await keys.rotationDue(USER, WEEK)).toBe(false)
  })

  test('rotar avanza la cadena y borra el eslabón viejo del llavero', async () => {
    const { secure, keys, advance } = setup()
    await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const chain1 = b64Decode(chainOf(secure)!)
    advance(WEEK)
    expect(await keys.rotationDue(USER, WEEK)).toBe(true)
    const rotated = await keys.rotateBoxKey(USER, 1)
    const chain2 = b64Decode(chainOf(secure)!)
    expect(chain2).toEqual(nextChainKey(chain1))
    expect(rotated.boxKey).toBe(b64Encode(boxKeyPairFromChain(chain2).publicKey))
    expect(verifyBoxKey(rotated).boxKeyId).toBe(2)
    // En el llavero solo queda chain_2: chain_1 no se puede recuperar desde ahí.
    const stored = [...secure.dump().values()]
    expect(stored).not.toContain(b64Encode(chain1))
    expect(await keys.rotationDue(USER, WEEK)).toBe(false)
  })

  test('instalación v1 (cajas aleatorias, sin cadena): la primera rotación arranca una cadena nueva', async () => {
    const { secure, keys } = setup()
    const first = await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    // Simula el formato v1: meta sin campos de cadena y sin eslabón guardado.
    const metaKey = `e2ee_v1_${USER}_meta`
    const meta = JSON.parse(secure.dump().get(metaKey)!)
    delete meta.chainKeyId
    delete meta.rotatedAt
    secure.dump().set(metaKey, JSON.stringify(meta))
    secure.dump().delete(`e2ee_v1_${USER}_chain`)

    expect(await keys.rotationDue(USER, WEEK)).toBe(true)
    const rotated = await keys.rotateBoxKey(USER, first.bundle.boxKeyId)
    const chain = b64Decode(chainOf(secure)!)
    expect(rotated.boxKey).toBe(b64Encode(boxKeyPairFromChain(chain).publicKey))
    expect(rotated.identityKey).toBe(first.bundle.identityKey)
    // La caja v1 sigue disponible para su historial hasta que se pode.
    expect(await keys.getBoxSecret(USER, first.bundle.boxKeyId)).not.toBeNull()
  })

  test('publishedAt solo cuenta para la caja vigente y se reinicia al rotar', async () => {
    const { keys, advance } = setup()
    await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    expect((await keys.keyStatus(USER))!.publishedAt).toBeNull()
    await keys.markPublished(USER, 1)
    const published = (await keys.keyStatus(USER))!.publishedAt
    expect(published).not.toBeNull()
    advance(1000)
    await keys.rotateBoxKey(USER, 1)
    expect((await keys.keyStatus(USER))!.publishedAt).toBeNull()
    await keys.markPublished(USER, 1)
    expect((await keys.keyStatus(USER))!.publishedAt).toBeNull()
    await keys.markPublished(USER, 2)
    expect((await keys.keyStatus(USER))!.publishedAt).toBe(published! + 1000)
  })

  test('otro teléfono con la misma cadena rotó: se adopta su caja sin subir nada (sin ping-pong)', async () => {
    const a = setup('phone-a')
    const first = await a.keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const b = setup('phone-b')
    await b.keys.importMaterial(USER, await a.keys.exportMaterial(USER))

    // A rota dos veces (por ejemplo, dos semanas) y publica.
    await a.keys.rotateBoxKey(USER, 1)
    const server = await a.keys.rotateBoxKey(USER, 2)

    const result = await b.keys.ensureDeviceKeys(USER, {
      serverCurrentBoxKeyId: server.boxKeyId,
      serverIdentityKey: server.identityKey,
      serverBoxKey: server.boxKey,
    })
    expect(result).toMatchObject({ rotated: false, needsUpload: false })
    expect(result.bundle).toEqual(server)
    expect(await b.keys.getBoxSecret(USER, server.boxKeyId)).toEqual(await a.keys.getBoxSecret(USER, server.boxKeyId))
    expect(result.bundle.identityKey).toBe(first.bundle.identityKey)
  })

  test('identidad igual pero caja que la cadena no produce: rota por encima, como siempre', async () => {
    const a = setup('phone-a')
    const mine = await a.keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const foreign = setup('phone-x')
    const other = await foreign.keys.ensureDeviceKeys('someone', { serverCurrentBoxKeyId: 4 })
    const result = await a.keys.ensureDeviceKeys(USER, {
      serverCurrentBoxKeyId: 5,
      serverIdentityKey: mine.bundle.identityKey,
      serverBoxKey: other.bundle.boxKey,
    })
    expect(result).toMatchObject({ rotated: true, needsUpload: true })
    expect(result.bundle.boxKeyId).toBe(6)
  })

  test('exportar e importar en un teléfono vacío copia identidad, cadena y cajas', async () => {
    const a = setup('phone-a')
    await a.keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    await a.keys.rotateBoxKey(USER, 1)
    const b = setup('phone-b')
    const bundle = await b.keys.importMaterial(USER, await a.keys.exportMaterial(USER))
    expect(bundle).toEqual(await a.keys.publicBundle(USER))
    expect(await b.keys.listBoxKeyIds(USER)).toEqual([1, 2])
    expect(chainOf(b.secure)).toBe(chainOf(a.secure))
    expect(await b.keys.getBoxSecret(USER, 1)).toEqual(await a.keys.getBoxSecret(USER, 1))
  })

  test('importar otra identidad reemplaza las llaves propias; material alterado no instala nada', async () => {
    const a = setup('phone-a')
    await a.keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    const b = setup('phone-b')
    const own = await b.keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: 1 })
    const material = await a.keys.exportMaterial(USER)

    const forged = { ...material, boxKeys: material.boxKeys.map((k) => ({ ...k, pk: own.bundle.boxKey })) }
    const error = await b.keys.importMaterial(USER, forged).catch((e: unknown) => e)
    expect(isE2eeError(error, 'invalid_key')).toBe(true)
    expect(await b.keys.publicBundle(USER)).toEqual(own.bundle)

    const installed = await b.keys.importMaterial(USER, material)
    expect(installed.identityKey).toBe(material.identity.pk)
    expect(await b.keys.listBoxKeyIds(USER)).toEqual([1])
    expect(b.secure.dump().has(`e2ee_v1_${USER}_box_2`)).toBe(false)
  })

  test('wipe borra también la cadena', async () => {
    const { secure, keys } = setup()
    await keys.ensureDeviceKeys(USER, { serverCurrentBoxKeyId: null })
    await keys.wipeDeviceKeys(USER)
    expect(secure.dump().size).toBe(0)
  })
})
