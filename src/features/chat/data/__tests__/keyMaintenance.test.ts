import { ApiError } from '@/lib/api/errors'
import { createFakeChatServer, createTestDeps } from '../../__fixtures__/fakeChatServer'
import { seededRandom } from '../../crypto/__fixtures__/seededRandom'
import { createDeviceKeys } from '../../keys/deviceKeys'
import { createMemoryKeyValueStore, createMemorySecretStore } from '../../keys/storage'
import { createMemoryStoreProvider } from '../../local/memoryStore'
import { createLocalStores } from '../../local/registry'
import type { ChatDeps } from '../deps'
import { ROTATION_INTERVAL_MS, runKeyMaintenance } from '../keyMaintenance'
import { ensureKeysPublished, forgetPublishedKeys } from '../publishKeys'
import { clearChatSessions, getChatSession } from '../session'

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('expo-crypto', () => ({ randomUUID: () => globalThis.crypto.randomUUID() }))

const ANA = '0b6f1c1e-0000-4000-8000-00000000000a'
const BRUNO = '0b6f1c1e-0000-4000-8000-00000000000b'
const MATCH = '7d2a3c4b-0000-4000-8000-000000000001'

function setup({ withLocal = true } = {}) {
  const server = createFakeChatServer()
  server.addUser(ANA, 'Ana')
  server.addUser(BRUNO, 'Bruno')
  server.addMatch(MATCH, ANA, BRUNO)
  let clock = Date.UTC(2026, 9, 1)
  const now = () => clock
  const provider = createMemoryStoreProvider()
  const ana: ChatDeps = {
    ...createTestDeps(server, ANA, 'ana', withLocal ? { local: createLocalStores(provider) } : {}),
    deviceKeys: createDeviceKeys({
      secure: createMemorySecretStore(),
      kv: createMemoryKeyValueStore(),
      randomBytes: seededRandom('ana-keys'),
      now,
    }),
    now,
  }
  const bruno = createTestDeps(server, BRUNO, 'bruno')
  return {
    server,
    ana,
    bruno,
    provider,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

async function brunoSends(bruno: ChatDeps, texts: string[]) {
  await ensureKeysPublished(bruno, BRUNO)
  const session = getChatSession(bruno, BRUNO)
  // Siempre la llave vigente de Ana (lo que haría el envío real tras un 409 stale_recipient_key).
  await session.fetchPeer(MATCH)
  for (const body of texts) {
    const envelope = await session.seal(MATCH, ANA, { id: bruno.newId(), body, sentAt: Date.now() })
    await bruno.transport.send(MATCH, envelope)
  }
}

afterEach(() => {
  clearChatSessions()
  forgetPublishedKeys()
})

describe('rotación semanal y borrado de llaves viejas', () => {
  test('a los 7 días rota y publica; borra la caja vieja solo tras guardar y confirmar todo', async () => {
    const { server, ana, bruno, provider, advance } = setup()
    await runKeyMaintenance(ana, ANA)
    expect(server.keysOf(ANA)!.boxKeyId).toBe(1)
    await brunoSends(bruno, ['antes de rotar', 'otro'])

    advance(ROTATION_INTERVAL_MS - 1)
    expect(await runKeyMaintenance(ana, ANA)).toEqual({ rotated: false, pruned: [] })

    advance(1)
    expect(await runKeyMaintenance(ana, ANA)).toEqual({ rotated: true, pruned: [1] })
    expect(server.keysOf(ANA)!.boxKeyId).toBe(2)
    expect(await ana.deviceKeys.getBoxSecret(ANA, 1)).toBeNull()
    // Lo cifrado a la caja 1 ya estaba guardado y confirmado antes de borrarla.
    const rows = [...provider.stores.get(ANA)!.dump().values()]
    expect(rows.map((r) => r.body)).toEqual(['antes de rotar', 'otro'])
    expect(server.messagesOf(MATCH)).toHaveLength(0)

    // Lo nuevo llega cifrado a la caja 2 y se sigue leyendo.
    await brunoSends(bruno, ['después'])
    expect(server.messagesOf(MATCH)[0].recipientBoxKeyId).toBe(2)
    const opened = await getChatSession(ana, ANA).openAll(MATCH, BRUNO, server.messagesOf(MATCH))
    expect(opened[0].body).toBe('después')
  })

  test('si el ack falla, la caja vieja no se borra; cuando el ack pasa, sí', async () => {
    const { ana, bruno, advance } = setup()
    await runKeyMaintenance(ana, ANA)
    await brunoSends(bruno, ['pendiente'])
    const realAck = ana.transport.ack
    ana.transport.ack = async () => {
      throw new ApiError('network', 'Sin conexión')
    }

    advance(ROTATION_INTERVAL_MS)
    expect(await runKeyMaintenance(ana, ANA)).toEqual({ rotated: true, pruned: [] })
    expect(await ana.deviceKeys.listBoxKeyIds(ANA)).toEqual([1, 2])

    ana.transport.ack = realAck
    expect(await runKeyMaintenance(ana, ANA)).toEqual({ rotated: false, pruned: [1] })
  })

  test('lo que no se pudo abrir conserva la llave que lo descifraría', async () => {
    const { server, ana, bruno, advance } = setup()
    await runKeyMaintenance(ana, ANA)
    await brunoSends(bruno, ['bien'])
    const template = server.messagesOf(MATCH)[0]
    server.injectCorrupt(MATCH, BRUNO, { ...template, frankingTag: template.frankingTag ?? undefined })

    advance(ROTATION_INTERVAL_MS)
    expect(await runKeyMaintenance(ana, ANA)).toEqual({ rotated: true, pruned: [] })
    expect(await ana.deviceKeys.listBoxKeyIds(ANA)).toEqual([1, 2])
  })

  test('sin base local no rota: borrar llaves sin los mensajes guardados los perdería', async () => {
    const { ana, advance } = setup({ withLocal: false })
    await runKeyMaintenance(ana, ANA)
    advance(ROTATION_INTERVAL_MS * 3)
    expect(await runKeyMaintenance(ana, ANA)).toEqual({ rotated: false, pruned: [] })
    expect(await ana.deviceKeys.listBoxKeyIds(ANA)).toEqual([1])
  })
})
