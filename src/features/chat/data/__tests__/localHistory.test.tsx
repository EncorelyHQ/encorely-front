import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'
import { createFakeChatServer, createTestDeps, type FakeChatServer } from '../../__fixtures__/fakeChatServer'
import { useConversationAs } from '../../hooks/useConversation'
import { createMemoryStoreProvider } from '../../local/memoryStore'
import { createLocalStores } from '../../local/registry'
import { handleChatEvent } from '../../realtime/chatHub'
import { ChatDepsProvider } from '../ChatDepsContext'
import type { ChatDeps } from '../deps'
import { ensureKeysPublished } from '../publishKeys'
import { clearChatSessions, getChatSession } from '../session'

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('expo-crypto', () => ({ randomUUID: () => globalThis.crypto.randomUUID() }))

const ANA = '0b6f1c1e-0000-4000-8000-00000000000a'
const BRUNO = '0b6f1c1e-0000-4000-8000-00000000000b'
const MATCH = '7d2a3c4b-0000-4000-8000-000000000001'

type User = {
  id: string
  deps: ChatDeps
  provider: ReturnType<typeof createMemoryStoreProvider>
  queryClient: QueryClient
}

const clients: QueryClient[] = []
const newClient = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return client
}

async function setup() {
  const server = createFakeChatServer()
  server.addUser(ANA, 'Ana')
  server.addUser(BRUNO, 'Bruno')
  server.addMatch(MATCH, ANA, BRUNO)
  const make = (id: string, seed: string): User => {
    const provider = createMemoryStoreProvider()
    return {
      id,
      provider,
      deps: createTestDeps(server, id, seed, { local: createLocalStores(provider) }),
      queryClient: newClient(),
    }
  }
  const ana = make(ANA, 'ana')
  const bruno = make(BRUNO, 'bruno')
  await ensureKeysPublished(ana.deps, ANA)
  await ensureKeysPublished(bruno.deps, BRUNO)
  return { server, ana, bruno }
}

async function open(user: User) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={user.queryClient}>
      <ChatDepsProvider value={user.deps}>{children}</ChatDepsProvider>
    </QueryClientProvider>
  )
  const hook = await renderHook(() => useConversationAs(MATCH, user.id), { wrapper })
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
  return hook
}

// "Reinicia la app": sin memoria (sesiones, cache), con la misma base local y las mismas llaves.
function restart(user: User) {
  clearChatSessions()
  user.queryClient = newClient()
}

async function seed(from: User, peerId: string, texts: string[]) {
  const session = getChatSession(from.deps, from.id)
  for (const body of texts) {
    const envelope = await session.seal(MATCH, peerId, { id: from.deps.newId(), body, sentAt: Date.now() })
    await from.deps.transport.send(MATCH, envelope)
  }
}

const fromPeer = (server: FakeChatServer, senderId: string) =>
  server.messagesOf(MATCH).filter((m) => m.senderId === senderId)

afterEach(() => {
  clearChatSessions()
  clients.splice(0).forEach((c) => c.clear())
})

describe('historial local cifrado', () => {
  test('guarda lo recibido, confirma (ack) y el servidor lo borra; sin duplicados al llegar más', async () => {
    const { server, ana, bruno } = await setup()
    await seed(bruno, ANA, ['uno', 'dos', 'tres'])

    const a = await open(ana)
    expect(a.result.current.messages.map((m) => m.body)).toEqual(['uno', 'dos', 'tres'])
    expect(server.ackLog).toEqual([{ matchId: MATCH, userId: ANA, upToSeq: 3 }])
    expect(fromPeer(server, BRUNO)).toHaveLength(0)
    const rows = [...ana.provider.stores.get(ANA)!.dump().values()]
    expect(rows.map((r) => r.body)).toEqual(['uno', 'dos', 'tres'])
    // La evidencia para reportes (p + fk) también queda guardada.
    expect(rows.every((r) => r.p && r.fk)).toBe(true)

    await seed(bruno, ANA, ['cuatro'])
    const newest = server.messagesOf(MATCH).at(-1)!
    const event = { type: 'MessageAvailable' as const, matchId: MATCH, id: newest.id, seq: newest.seq }
    await act(async () => handleChatEvent(ana.queryClient, event))
    await waitFor(() => expect(a.result.current.messages).toHaveLength(4))
    await act(async () => handleChatEvent(ana.queryClient, event))

    expect(new Set(a.result.current.messages.map((m) => m.id)).size).toBe(4)
    expect(a.result.current.messages.map((m) => m.seq)).toEqual([1, 2, 3, 4])
    expect(server.ackLog.map((x) => x.upToSeq)).toEqual([3, 4])
    expect(server.pageLog.filter((p) => p.after !== undefined).map((p) => p.after)).toEqual([0, 3])

    await a.unmount()
    restart(ana)
    const again = await open(ana)
    expect(again.result.current.messages.map((m) => m.body)).toEqual(['uno', 'dos', 'tres', 'cuatro'])
    expect(again.result.current.evidence()).toHaveLength(4)
  })

  test('mis envíos quedan en mi historial aunque el otro ya los haya confirmado', async () => {
    const { server, ana, bruno } = await setup()
    const a = await open(ana)
    await act(async () => {
      a.result.current.send('Nos vemos en la puerta 3')
    })
    await waitFor(() => expect(a.result.current.messages.at(-1)?.status).toBe('sent'))

    const b = await open(bruno)
    expect(b.result.current.messages.map((m) => m.body)).toEqual(['Nos vemos en la puerta 3'])
    expect(server.messagesOf(MATCH)).toHaveLength(0)

    await a.unmount()
    restart(ana)
    const again = await open(ana)
    expect(again.result.current.messages).toHaveLength(1)
    expect(again.result.current.messages[0]).toMatchObject({ mine: true, body: 'Nos vemos en la puerta 3', seq: 1 })
  })

  test('un envío propio con seq mayor no hace saltar un mensaje del otro que aún no había llegado', async () => {
    const { server, ana, bruno } = await setup()
    const a = await open(ana)
    await seed(bruno, ANA, ['¿ya llegaste?'])
    await act(async () => {
      a.result.current.send('Voy entrando')
    })
    await waitFor(() => expect(a.result.current.messages.find((m) => m.mine)?.status).toBe('sent'))

    const first = server.messagesOf(MATCH)[0]
    await act(async () =>
      handleChatEvent(ana.queryClient, { type: 'MessageAvailable', matchId: MATCH, id: first.id, seq: first.seq }),
    )
    await waitFor(() => expect(a.result.current.messages).toHaveLength(2))
    expect(a.result.current.messages.map((m) => m.body)).toEqual(['¿ya llegaste?', 'Voy entrando'])
    expect(fromPeer(server, BRUNO)).toHaveLength(0)
  })

  test('lo que no se puede abrir se guarda con su sobre y se confirma igual (no se pierde)', async () => {
    const { server, ana, bruno } = await setup()
    await seed(bruno, ANA, ['ok'])
    const template = server.messagesOf(MATCH)[0]
    server.injectCorrupt(MATCH, BRUNO, { ...template, frankingTag: template.frankingTag ?? undefined })

    const a = await open(ana)
    expect(a.result.current.messages.map((m) => m.status)).toEqual(['sent', 'undecryptable'])
    expect(server.messagesOf(MATCH)).toHaveLength(0)
    const stored = await ana.provider.stores.get(ANA)!.undecryptable(MATCH)
    expect(stored).toHaveLength(1)
    expect(JSON.parse(stored[0].envelope!).ciphertext).toBeTruthy()
  })

  test('sin red se lee lo guardado', async () => {
    const { ana, bruno } = await setup()
    await seed(bruno, ANA, ['guardado'])
    const a = await open(ana)
    await a.unmount()

    restart(ana)
    ana.deps.transport.page = async () => {
      throw new ApiError('network', 'Sin conexión')
    }
    const again = await open(ana)
    expect(again.result.current.messages.map((m) => m.body)).toEqual(['guardado'])
  })

  test('sin base local (no abrió) funciona como v1: solo servidor y sin ack', async () => {
    const { server, ana, bruno } = await setup()
    ana.deps.local = createLocalStores({
      open: async () => {
        throw new Error('SQLCipher no disponible')
      },
      wipe: async () => undefined,
    })
    await seed(bruno, ANA, ['hola'])
    const a = await open(ana)
    expect(a.result.current.messages.map((m) => m.body)).toEqual(['hola'])
    expect(server.ackLog).toEqual([])
    expect(fromPeer(server, BRUNO)).toHaveLength(1)
  })

  test('paginación hacia atrás desde la base local', async () => {
    const { ana, bruno } = await setup()
    await seed(
      bruno,
      ANA,
      Array.from({ length: 70 }, (_, i) => `m${i + 1}`),
    )
    const a = await open(ana)
    expect(a.result.current.messages).toHaveLength(50)
    expect(a.result.current.hasMore).toBe(true)
    await act(async () => a.result.current.loadOlder())
    expect(a.result.current.messages.map((m) => m.seq)).toEqual(Array.from({ length: 70 }, (_, i) => i + 1))
    expect(a.result.current.hasMore).toBe(false)
  })
})
