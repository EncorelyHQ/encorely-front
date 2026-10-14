import { createFakeChatServer, createTestDeps } from '../../__fixtures__/fakeChatServer'
import { createFakeSyncServer } from '../../__fixtures__/fakeSyncServer'
import { b64Encode, utf8 } from '../../crypto/bytes'
import { isE2eeError } from '../../crypto/errors'
import { sealToPublicKey } from '../../crypto/sealedBox'
import { ensureKeysPublished, forgetPublishedKeys } from '../../data/publishKeys'
import { clearChatSessions, getChatSession } from '../../data/session'
import {
  acceptLink,
  checkLinkRequest,
  NotALinkQrError,
  openLinkRequest,
  prepareLinkTransfer,
} from '../linkDevice'

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('expo-crypto', () => ({ randomUUID: () => globalThis.crypto.randomUUID() }))

const ANA = '0b6f1c1e-0000-4000-8000-00000000000a'
const BRUNO = '0b6f1c1e-0000-4000-8000-00000000000b'
const MATCH = '7d2a3c4b-0000-4000-8000-000000000001'

async function setup() {
  const server = createFakeChatServer()
  const sync = createFakeSyncServer()
  server.addUser(ANA, 'Ana')
  server.addUser(BRUNO, 'Bruno')
  server.addMatch(MATCH, ANA, BRUNO)
  const oldPhone = createTestDeps(server, ANA, 'ana-old')
  const newPhone = createTestDeps(server, ANA, 'ana-new')
  const bruno = createTestDeps(server, BRUNO, 'bruno')
  await ensureKeysPublished(oldPhone, ANA)
  await ensureKeysPublished(bruno, BRUNO)
  return { server, sync, oldPhone, newPhone, bruno, transport: sync.linkFor(ANA) }
}

afterEach(() => {
  clearChatSessions()
  forgetPublishedKeys()
})

describe('traspaso de llaves a otro teléfono', () => {
  test('ida y vuelta: mismo código en los dos, el nuevo instala la identidad y publica por encima', async () => {
    const { server, sync, oldPhone, newPhone, bruno, transport } = await setup()
    // El teléfono nuevo, al entrar, ya publicó su propia identidad.
    await ensureKeysPublished(newPhone, ANA)
    const serverBefore = server.keysOf(ANA)!.boxKeyId

    const pending = await openLinkRequest(transport)
    expect(pending.qr).toMatch(/^encorely-link:v1:[0-9a-f-]{36}:[A-Za-z0-9_-]{43}$/)
    expect(await checkLinkRequest(transport, pending)).toBeNull()

    const prepared = await prepareLinkTransfer({ deps: oldPhone, me: ANA, transport, qrText: pending.qr })
    // Nada sale del teléfono viejo hasta confirmar.
    expect(sync.links.get(pending.linkId)!.status).toBe('pending')
    await prepared.send()
    // El servidor solo ve el material cifrado.
    const material = await oldPhone.deviceKeys.exportMaterial(ANA)
    expect(JSON.stringify(sync.links.get(pending.linkId))).not.toContain(material.identity.sk)

    const received = await checkLinkRequest(transport, pending)
    expect(received!.code).toBe(prepared.code)
    expect(received!.code).toMatch(/^\d{6}$/)

    await acceptLink({ deps: newPhone, me: ANA, transport, pending, received: received! })
    expect(pending.secretKey.every((b) => b === 0)).toBe(true)
    expect(sync.links.has(pending.linkId)).toBe(false)
    const oldBundle = (await oldPhone.deviceKeys.publicBundle(ANA))!
    expect(server.keysOf(ANA)!.identityKey).toBe(oldBundle.identityKey)
    expect(server.keysOf(ANA)!.boxKeyId).toBeGreaterThan(serverBefore)

    // El viejo ve la caja nueva con su misma identidad y la adopta: no rota de vuelta (sin ping-pong).
    forgetPublishedKeys()
    const published = server.keysOf(ANA)!
    await ensureKeysPublished(oldPhone, ANA)
    expect(server.keysOf(ANA)).toEqual(published)
    expect((await oldPhone.deviceKeys.publicBundle(ANA))!.boxKey).toBe(published.boxKey)

    // Bruno escribe a la caja vigente: ambos teléfonos la abren.
    const session = getChatSession(bruno, BRUNO)
    await session.fetchPeer(MATCH)
    await bruno.transport.send(MATCH, await session.seal(MATCH, ANA, { id: bruno.newId(), body: 'Hola', sentAt: 1 }))
    const items = server.messagesOf(MATCH)
    expect((await getChatSession(newPhone, ANA).openAll(MATCH, BRUNO, items))[0].body).toBe('Hola')
    expect((await getChatSession(oldPhone, ANA).openAll(MATCH, BRUNO, items))[0].body).toBe('Hola')
  })

  test('el buzón es de un solo uso', async () => {
    const { oldPhone, transport } = await setup()
    const pending = await openLinkRequest(transport)
    const prepared = await prepareLinkTransfer({ deps: oldPhone, me: ANA, transport, qrText: pending.qr })
    await prepared.send()
    await expect(prepared.send()).rejects.toMatchObject({ code: 'link_already_fulfilled' })
    const again = await prepareLinkTransfer({ deps: oldPhone, me: ANA, transport, qrText: pending.qr }).catch(
      (e: unknown) => e,
    )
    expect(isE2eeError(again, 'invalid_input')).toBe(true)
  })

  test('si el servidor cambió la efímera del buzón, el viejo no envía nada', async () => {
    const { sync, oldPhone, transport } = await setup()
    const pending = await openLinkRequest(transport)
    const attacker = await openLinkRequest(sync.linkFor('attacker'))
    sync.tamperLink(pending.linkId, { newDeviceEphemeralKey: b64Encode(attacker.publicKey) })
    const error = await prepareLinkTransfer({ deps: oldPhone, me: ANA, transport, qrText: pending.qr }).catch(
      (e: unknown) => e,
    )
    expect(isE2eeError(error, 'identity_mismatch')).toBe(true)
    expect(sync.links.get(pending.linkId)!.status).toBe('pending')
  })

  test('material inyectado por el servidor: el código no coincide con el del viejo', async () => {
    const { sync, oldPhone, newPhone, transport } = await setup()
    await ensureKeysPublished(newPhone, ANA)
    const pending = await openLinkRequest(transport)
    const prepared = await prepareLinkTransfer({ deps: oldPhone, me: ANA, transport, qrText: pending.qr })
    // En vez del material del viejo, el servidor pone uno propio cifrado a la efímera del QR.
    const forged = sealToPublicKey(
      pending.publicKey,
      utf8(JSON.stringify({ v: 1, userId: ANA, keys: await newPhone.deviceKeys.exportMaterial(ANA) })),
      utf8(pending.linkId),
    )
    sync.tamperLink(pending.linkId, {
      status: 'ready',
      senderEphemeralKey: b64Encode(forged.senderEphemeralKey),
      nonce: b64Encode(forged.nonce),
      ciphertext: b64Encode(forged.ciphertext),
    })
    const received = await checkLinkRequest(transport, pending)
    // La persona ve dos códigos distintos y no confirma: nada se instala.
    expect(received!.code).not.toBe(prepared.code)
  })

  test('un QR que no es de vinculación se rechaza sin tocar el servidor', async () => {
    const { oldPhone, transport } = await setup()
    const error = await prepareLinkTransfer({ deps: oldPhone, me: ANA, transport, qrText: 'encorely:v1:AAAA' }).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(NotALinkQrError)
  })
})
