import { createFakeChatServer, createTestDeps } from '../../__fixtures__/fakeChatServer'
import { createFakeSyncServer } from '../../__fixtures__/fakeSyncServer'
import { isE2eeError } from '../../crypto/errors'
import { pullToLocal } from '../../data/localSync'
import { ensureKeysPublished, forgetPublishedKeys } from '../../data/publishKeys'
import { clearChatSessions, getChatSession } from '../../data/session'
import { createMemoryStoreProvider } from '../../local/memoryStore'
import { createLocalStores } from '../../local/registry'
import { backupInfo, createBackup, restoreBackup } from '../backup'
import { passphraseStrength } from '../passphrase'

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('expo-crypto', () => ({ randomUUID: () => globalThis.crypto.randomUUID() }))

const ANA = '0b6f1c1e-0000-4000-8000-00000000000a'
const BRUNO = '0b6f1c1e-0000-4000-8000-00000000000b'
const MATCH = '7d2a3c4b-0000-4000-8000-000000000001'
const PHRASE = 'tres perros comen arepa en el estadio'

async function setup() {
  const server = createFakeChatServer()
  const sync = createFakeSyncServer()
  server.addUser(ANA, 'Ana')
  server.addUser(BRUNO, 'Bruno')
  server.addMatch(MATCH, ANA, BRUNO)
  const oldProvider = createMemoryStoreProvider()
  const oldPhone = createTestDeps(server, ANA, 'ana-old', { local: createLocalStores(oldProvider) })
  const bruno = createTestDeps(server, BRUNO, 'bruno')
  await ensureKeysPublished(oldPhone, ANA)
  await ensureKeysPublished(bruno, BRUNO)
  return { server, sync, oldPhone, oldProvider, bruno }
}

async function send(from: ReturnType<typeof createTestDeps>, me: string, peer: string, texts: string[]) {
  const session = getChatSession(from, me)
  await session.fetchPeer(MATCH)
  for (const body of texts) {
    const envelope = await session.seal(MATCH, peer, { id: from.newId(), body, sentAt: Date.now() })
    await from.transport.send(MATCH, envelope)
  }
}

afterEach(() => {
  clearChatSessions()
  forgetPublishedKeys()
})

describe('respaldo cifrado con frase', () => {
  test('ida y vuelta a un teléfono nuevo: llaves, cadena e historial; publica por encima del servidor', async () => {
    const { server, sync, oldPhone, oldProvider, bruno } = await setup()
    await send(bruno, BRUNO, ANA, ['¿Vamos al de Bomba?', 'Tengo boletas'])
    const store = (await oldPhone.local!.get(ANA))!
    await pullToLocal({
      session: getChatSession(oldPhone, ANA),
      transport: oldPhone.transport,
      store,
      matchId: MATCH,
      peerUserId: BRUNO,
      now: Date.now(),
      maxRounds: 5,
    })
    expect(server.messagesOf(MATCH)).toHaveLength(0)

    const transport = sync.backupFor(ANA)
    expect(await backupInfo(transport)).toBeNull()
    const progress: number[] = []
    const info = await createBackup({
      deps: oldPhone,
      me: ANA,
      passphrase: PHRASE,
      includeHistory: true,
      transport,
      onProgress: (p) => progress.push(p),
    })
    expect(info.sizeBytes).toBeGreaterThan(0)
    expect(progress.at(-1)).toBe(1)
    // El servidor solo tiene ciphertext: ni la frase ni el texto aparecen.
    const stored = JSON.stringify(sync.backups.get(ANA))
    expect(stored).not.toContain('Bomba')
    expect(stored).not.toContain('perros')
    expect(sync.backups.get(ANA)!.kdf).toEqual({ algorithm: 'scrypt', opsLimit: 2 ** 15, memLimit: 128 * 8 * 2 ** 15 })

    // Teléfono nuevo: al entrar ya generó y publicó una identidad propia.
    clearChatSessions()
    forgetPublishedKeys()
    const newProvider = createMemoryStoreProvider()
    const newPhone = createTestDeps(server, ANA, 'ana-new', { local: createLocalStores(newProvider) })
    await ensureKeysPublished(newPhone, ANA)
    const oldIdentity = (await oldPhone.deviceKeys.publicBundle(ANA))!.identityKey
    expect(server.keysOf(ANA)!.identityKey).not.toBe(oldIdentity)
    const serverBefore = server.keysOf(ANA)!.boxKeyId

    const wrong = await restoreBackup({ deps: newPhone, me: ANA, passphrase: 'tres perros comen arepa en el estadi0', transport }).catch(
      (e: unknown) => e,
    )
    expect(isE2eeError(wrong, 'aead_failed')).toBe(true)

    const restored = await restoreBackup({ deps: newPhone, me: ANA, passphrase: PHRASE, transport })
    expect(restored.messages).toBe(2)
    expect(server.keysOf(ANA)!.identityKey).toBe(oldIdentity)
    expect(server.keysOf(ANA)!.boxKeyId).toBeGreaterThan(serverBefore)
    const rows = [...newProvider.stores.get(ANA)!.dump().values()]
    expect(rows.map((r) => r.body)).toEqual(['¿Vamos al de Bomba?', 'Tengo boletas'])
    expect(rows.every((r) => r.p && r.fk)).toBe(true)
    expect(oldProvider.stores.get(ANA)!.dump().size).toBe(2)

    // Bruno escribe a la caja nueva y el teléfono nuevo lo lee.
    await send(bruno, BRUNO, ANA, ['Te espero'])
    const opened = await getChatSession(newPhone, ANA).openAll(MATCH, BRUNO, server.messagesOf(MATCH))
    expect(opened.map((m) => m.body)).toEqual(['Te espero'])
  })

  test('sin historial pesa menos y no importa mensajes', async () => {
    const { sync, oldPhone } = await setup()
    const transport = sync.backupFor(ANA)
    await createBackup({ deps: oldPhone, me: ANA, passphrase: PHRASE, includeHistory: false, transport })
    const restored = await restoreBackup({ deps: oldPhone, me: ANA, passphrase: PHRASE, transport })
    expect(restored.messages).toBe(0)
  })

  test('un respaldo de otra cuenta no se instala aunque la frase coincida', async () => {
    const { sync, oldPhone, bruno } = await setup()
    await createBackup({ deps: bruno, me: BRUNO, passphrase: PHRASE, includeHistory: false, transport: sync.backupFor(BRUNO) })
    const error = await restoreBackup({
      deps: oldPhone,
      me: ANA,
      passphrase: PHRASE,
      transport: sync.backupFor(BRUNO),
    }).catch((e: unknown) => e)
    expect(isE2eeError(error, 'identity_mismatch')).toBe(true)
  })
})

describe('fuerza de la frase', () => {
  test('pide 4 palabras o 16 caracteres y frena repeticiones', () => {
    expect(passphraseStrength('').level).toBe('empty')
    expect(passphraseStrength('rock salsa').ok).toBe(false)
    expect(passphraseStrength('aaaaaaaaaaaaaaaaaaaa').ok).toBe(false)
    expect(passphraseStrength('perro perro perro perro').ok).toBe(false)
    expect(passphraseStrength('tres perros comen arepa')).toMatchObject({ ok: true, level: 'fair' })
    expect(passphraseStrength('Concierto2026!Medellin').ok).toBe(true)
    expect(passphraseStrength('tres perros comen arepa en el estadio')).toMatchObject({ ok: true, level: 'strong' })
  })
})
