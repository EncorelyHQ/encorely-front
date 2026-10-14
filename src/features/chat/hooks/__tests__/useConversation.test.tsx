import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'
import { createFakeChatServer, createTestDeps, type FakeChatServer } from '../../__fixtures__/fakeChatServer'
import { ChatDepsProvider } from '../../data/ChatDepsContext'
import type { ChatDeps } from '../../data/deps'
import { ensureKeysPublished } from '../../data/publishKeys'
import { clearChatSessions, getChatSession } from '../../data/session'
import { handleChatEvent } from '../../realtime/chatHub'
import { useConversationAs } from '../useConversation'

// La app real guarda los pines en AsyncStorage; aquí el módulo nativo no existe y los tests usan stores en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('expo-crypto', () => ({ randomUUID: () => globalThis.crypto.randomUUID() }))

const ANA = '0b6f1c1e-0000-4000-8000-00000000000a'
const BRUNO = '0b6f1c1e-0000-4000-8000-00000000000b'
const MATCH = '7d2a3c4b-0000-4000-8000-000000000001'

type User = { id: string; deps: ChatDeps; queryClient: QueryClient }

const clients: QueryClient[] = []

function makeQueryClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  return client
}

async function setup() {
  const server = createFakeChatServer()
  server.addUser(ANA, 'Ana')
  server.addUser(BRUNO, 'Bruno')
  server.addMatch(MATCH, ANA, BRUNO)
  const ana: User = { id: ANA, deps: createTestDeps(server, ANA, 'ana'), queryClient: makeQueryClient() }
  const bruno: User = { id: BRUNO, deps: createTestDeps(server, BRUNO, 'bruno'), queryClient: makeQueryClient() }
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
  await waitFor(() => expect(hook.result.current.peerState.kind).toBe('ready'))
  return hook
}

// Envía directo con la sesión criptográfica (sin UI) para sembrar historial rápido.
async function seed(server: FakeChatServer, from: User, peerId: string, texts: string[]) {
  const session = getChatSession(from.deps, from.id)
  for (const body of texts) {
    const envelope = await session.seal(MATCH, peerId, { id: from.deps.newId(), body, sentAt: Date.now() })
    await from.deps.transport.send(MATCH, envelope)
  }
}

afterEach(() => {
  clearChatSessions()
  // Sin esto los timers de gc de React Query dejan a Jest esperando.
  clients.splice(0).forEach((c) => c.clear())
})

describe('useConversation', () => {
  test('A envía, B recibe y descifra; el texto solo viaja cifrado', async () => {
    const { server, ana, bruno } = await setup()
    const a = await open(ana)
    // El POST queda en vuelo hasta soltarlo: así se ve el estado optimista.
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const realSend = ana.deps.transport.send
    ana.deps.transport.send = async (...args) => {
      await gate
      return realSend(...args)
    }

    await act(async () => {
      expect(a.result.current.send('  Hola, ¿vas al concierto?  ')).toBe(true)
    })
    expect(a.result.current.messages.at(-1)).toMatchObject({ status: 'sending', mine: true, seq: null })
    await act(async () => release())
    await waitFor(() => expect(a.result.current.messages.at(-1)).toMatchObject({ status: 'sent', seq: 1 }))
    expect(a.result.current.messages).toHaveLength(1)
    expect(a.result.current.messages[0].body).toBe('Hola, ¿vas al concierto?')

    const wire = server.messagesOf(MATCH)[0]
    expect(wire.ciphertext).not.toContain('concierto')
    expect(JSON.stringify(wire)).not.toContain('Hola')

    const b = await open(bruno)
    expect(b.result.current.messages).toHaveLength(1)
    const received = b.result.current.messages[0]
    expect(received).toMatchObject({ mine: false, senderId: ANA, status: 'sent', body: 'Hola, ¿vas al concierto?' })
    // Evidencia para reportes: el mismo id, el texto interno exacto y su franking key.
    const [evidence] = b.result.current.evidence()
    expect(evidence.messageId).toBe(wire.id)
    expect(JSON.parse(evidence.plaintext).b).toBe('Hola, ¿vas al concierto?')
    expect(evidence.frankingKey).toMatch(/^[A-Za-z0-9+/]+=*$/)
    // Lo propio no se ofrece como evidencia.
    expect(a.result.current.evidence()).toEqual([])
  })

  test('409 stale_recipient_key: refresca las llaves de B y re-sella con el MISMO id', async () => {
    const { server, ana, bruno } = await setup()
    const a = await open(ana)
    const oldKeyId = server.keysOf(BRUNO)!.boxKeyId

    // B rota su llave después de que A la cacheó.
    const rotated = await bruno.deps.deviceKeys.rotateBoxKey(BRUNO, oldKeyId)
    await bruno.deps.transport.publishKeys(rotated)

    await act(async () => {
      a.result.current.send('¿Nos vemos en la entrada?')
    })
    await waitFor(() => expect(a.result.current.messages.at(-1)?.status).toBe('sent'))

    const attempts = server.sendLog
    expect(attempts).toHaveLength(2)
    expect(attempts[0]).toMatchObject({ ok: false, recipientBoxKeyId: oldKeyId })
    expect(attempts[1]).toMatchObject({ ok: true, recipientBoxKeyId: rotated.boxKeyId })
    expect(attempts[1].id).toBe(attempts[0].id)
    expect(a.result.current.messages[0].id).toBe(attempts[0].id)

    const b = await open(bruno)
    expect(b.result.current.messages[0].body).toBe('¿Nos vemos en la entrada?')
  })

  test('fallo de red → "fallido"; reintentar reenvía el mismo sobre (idempotente)', async () => {
    const { server, ana } = await setup()
    const a = await open(ana)
    server.failNextSend(new ApiError('network', 'Sin conexión'))

    await act(async () => {
      a.result.current.send('Llego a las 8')
    })
    await waitFor(() => expect(a.result.current.messages.at(-1)?.status).toBe('failed'))
    const failedId = a.result.current.messages.at(-1)!.id

    await act(async () => a.result.current.retry(failedId))
    await waitFor(() => expect(a.result.current.messages.at(-1)?.status).toBe('sent'))
    expect(a.result.current.messages).toHaveLength(1)
    expect(a.result.current.messages[0].id).toBe(failedId)
    expect(server.messagesOf(MATCH)).toHaveLength(1)
    expect(server.sendLog.map((s) => s.id)).toEqual([failedId, failedId])
  })

  test('409 message_already_delivered → se da por enviado, sin reintentar', async () => {
    const { server, ana } = await setup()
    const a = await open(ana)
    server.failNextSend(new ApiError('http', 'Ya entregado', { status: 409, code: 'message_already_delivered' }))

    await act(async () => {
      a.result.current.send('Ya estoy en la fila')
    })
    await waitFor(() => expect(a.result.current.messages.at(-1)?.status).toBe('sent'))
    expect(a.result.current.messages).toHaveLength(1)
    expect(a.result.current.messages[0]).toMatchObject({ body: 'Ya estoy en la fila', seq: null, mine: true })
    expect(server.sendLog).toHaveLength(1)
  })

  test('un sobre manipulado se muestra como "no descifrable" sin romper el resto', async () => {
    const { server, ana, bruno } = await setup()
    await seed(server, bruno, ANA, ['primero'])
    const template = server.messagesOf(MATCH)[0]
    server.injectCorrupt(MATCH, BRUNO, { ...template, frankingTag: template.frankingTag ?? undefined })
    await seed(server, bruno, ANA, ['tercero'])

    const a = await open(ana)
    expect(a.result.current.messages.map((m) => [m.status, m.body])).toEqual([
      ['sent', 'primero'],
      ['undecryptable', null],
      ['sent', 'tercero'],
    ])
    expect(a.result.current.messages[1].evidence).toBeUndefined()
  })

  test('paginación before/after sin duplicados y en orden de seq', async () => {
    const { server, ana, bruno } = await setup()
    await seed(
      server,
      bruno,
      ANA,
      Array.from({ length: 120 }, (_, i) => `m${i + 1}`),
    )

    const a = await open(ana)
    const seqs = () => a.result.current.messages.map((m) => m.seq)
    expect(seqs()).toEqual(Array.from({ length: 50 }, (_, i) => 71 + i))
    expect(a.result.current.hasMore).toBe(true)

    await act(async () => a.result.current.loadOlder())
    expect(seqs()).toEqual(Array.from({ length: 100 }, (_, i) => 21 + i))
    await act(async () => a.result.current.loadOlder())
    expect(seqs()).toEqual(Array.from({ length: 120 }, (_, i) => 1 + i))
    expect(a.result.current.hasMore).toBe(false)
    expect(a.result.current.messages[0].body).toBe('m1')

    // Llega uno nuevo por el socket, dos veces (reconexión): se trae solo after=120 y no se duplica.
    await seed(server, bruno, ANA, ['nuevo'])
    const newest = server.messagesOf(MATCH).at(-1)!
    const event = { type: 'MessageAvailable' as const, matchId: MATCH, id: newest.id, seq: newest.seq }
    await act(async () => handleChatEvent(ana.queryClient, event))
    await waitFor(() => expect(a.result.current.messages).toHaveLength(121))
    await act(async () => handleChatEvent(ana.queryClient, event))

    expect(server.pageLog.filter((p) => p.after !== undefined).map((p) => p.after)).toEqual([120])
    const ids = a.result.current.messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(121)
    expect(seqs()).toEqual(Array.from({ length: 121 }, (_, i) => 1 + i))
    expect(a.result.current.messages.at(-1)?.body).toBe('nuevo')
  })

  test('contacto verificado que reinstala: aviso, envío bloqueado hasta aceptar el cambio', async () => {
    const { ana, bruno } = await setup()
    const a = await open(ana)
    const pinned = await ana.deps.peerKeys.get(ANA, BRUNO)
    await ana.deps.peerKeys.markVerified(ANA, BRUNO, pinned!.identityKey)

    // Bruno "reinstala": llaves nuevas con otra identidad.
    await bruno.deps.deviceKeys.wipeDeviceKeys(BRUNO)
    await ensureKeysPublished(bruno.deps, BRUNO, true)
    await act(async () =>
      handleChatEvent(ana.queryClient, { type: 'PeerKeyChanged', matchId: MATCH, userId: BRUNO }),
    )

    await waitFor(() => expect(a.result.current.peerState).toMatchObject({ kind: 'ready', requiresConfirmation: true }))
    expect(a.result.current.keyChanged).toBe(true)
    expect(a.result.current.peerState).toMatchObject({ trust: 'changed', canSend: false })

    await act(async () => a.result.current.acceptKeyChange())
    await waitFor(() => expect(a.result.current.peerState).toMatchObject({ trust: 'unverified', canSend: true }))
    // El aviso se queda en la conversación aunque ya se haya aceptado.
    expect(a.result.current.keyChanged).toBe(true)
  })

  test('B sin llaves publicadas: no hay a quién cifrar y no se inventa un envío en claro', async () => {
    const server = createFakeChatServer()
    server.addUser(ANA, 'Ana')
    server.addUser(BRUNO, 'Bruno')
    server.addMatch(MATCH, ANA, BRUNO)
    const ana: User = { id: ANA, deps: createTestDeps(server, ANA, 'ana2'), queryClient: makeQueryClient() }
    await ensureKeysPublished(ana.deps, ANA)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={ana.queryClient}>
        <ChatDepsProvider value={ana.deps}>{children}</ChatDepsProvider>
      </QueryClientProvider>
    )
    const a = await renderHook(() => useConversationAs(MATCH, ANA), { wrapper })
    await waitFor(() => expect(a.result.current.peerState.kind).toBe('noKeys'))
    expect(a.result.current.status).toBe('ready')
  })

  test('match cerrado → estado "closed"', async () => {
    const { server, ana } = await setup()
    server.closeMatch(MATCH)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={ana.queryClient}>
        <ChatDepsProvider value={ana.deps}>{children}</ChatDepsProvider>
      </QueryClientProvider>
    )
    const a = await renderHook(() => useConversationAs(MATCH, ANA), { wrapper })
    await waitFor(() => expect(a.result.current.status).toBe('closed'))
  })
})
