import { HubConnectionState } from '@microsoft/signalr'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import type { MatchSummary } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { emptyConversation, type ConversationData } from '../../data/messages'
import { createChatRealtime, type HubConnectionLike } from '../chatHub'

const MATCH = 'm-1'

type Handler = (payload: unknown) => void

function fakeConnection() {
  const handlers = new Map<string, Handler>()
  let reconnected: (() => void) | null = null
  const conn = {
    state: HubConnectionState.Disconnected as HubConnectionState,
    on: jest.fn((name: string, cb: Handler) => {
      handlers.set(name, cb)
    }),
    off: jest.fn((name: string) => {
      handlers.delete(name)
    }),
    start: jest.fn(async () => {
      conn.state = HubConnectionState.Connecting
      await Promise.resolve()
      conn.state = HubConnectionState.Connected
    }),
    stop: jest.fn(async () => {
      conn.state = HubConnectionState.Disconnected
    }),
    onreconnected: jest.fn((cb: () => void) => {
      reconnected = cb
    }),
  }
  return {
    conn,
    connection: conn as unknown as HubConnectionLike,
    emit: (name: string, payload: unknown) => handlers.get(name)?.(payload),
    reconnect: () => reconnected?.(),
    handlers,
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const clients: QueryClient[] = []
afterEach(() => clients.splice(0).forEach((c) => c.clear()))

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(queryClient)
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
  const hub = fakeConnection()
  const realtime = createChatRealtime({ connection: hub.connection, queryClient })
  return { queryClient, invalidate, hub, realtime }
}

const exactKeys = (spy: jest.SpyInstance) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey?: unknown; exact?: boolean }) ?? {})

describe('chat hub', () => {
  test('se suscribe a los cuatro eventos del contrato', () => {
    const { hub } = setup()
    expect([...hub.handlers.keys()].sort()).toEqual(['MatchClosed', 'MatchCreated', 'MessageAvailable', 'PeerKeyChanged'])
  })

  test('MessageAvailable sin conversación en memoria: solo refresca la lista de chats', async () => {
    const { hub, invalidate } = setup()
    hub.emit('MessageAvailable', { matchId: MATCH, id: 'x', seq: 3 })
    await flush()
    expect(exactKeys(invalidate)).toEqual([{ queryKey: queryKeys.matches, exact: true }])
  })

  test('MessageAvailable con conversación abierta: trae lo nuevo, salvo si ya lo tiene', async () => {
    const { hub, invalidate, queryClient } = setup()
    const data: ConversationData = { ...emptyConversation, newestSeq: 5, oldestSeq: 1 }
    queryClient.setQueryData(queryKeys.messages(MATCH), data)

    hub.emit('MessageAvailable', { matchId: MATCH, id: 'old', seq: 5 })
    await flush()
    expect(exactKeys(invalidate)).toEqual([{ queryKey: queryKeys.matches, exact: true }])

    invalidate.mockClear()
    hub.emit('MessageAvailable', { matchId: MATCH, id: 'new', seq: 6 })
    await flush()
    expect(exactKeys(invalidate)).toEqual([
      { queryKey: queryKeys.matches, exact: true },
      { queryKey: queryKeys.messages(MATCH), exact: true },
    ])
  })

  test('con la conversación en pantalla, el aviso dispara su queryFn (que trae after=newestSeq)', async () => {
    const { hub, queryClient } = setup()
    const queryFn = jest.fn(async () => ({ ...emptyConversation, newestSeq: 5 }))
    const observer = new QueryObserver(queryClient, { queryKey: queryKeys.messages(MATCH), queryFn, staleTime: Infinity })
    const unsubscribe = observer.subscribe(() => undefined)
    await flush()
    expect(queryFn).toHaveBeenCalledTimes(1)

    hub.emit('MessageAvailable', { matchId: MATCH, id: 'new', seq: 6 })
    await flush()
    expect(queryFn).toHaveBeenCalledTimes(2)
    unsubscribe()
    queryClient.clear()
  })

  test('PeerKeyChanged invalida solo las llaves de ese match', async () => {
    const { hub, invalidate } = setup()
    hub.emit('PeerKeyChanged', { matchId: MATCH, userId: 'u-2' })
    await flush()
    expect(exactKeys(invalidate)).toEqual([{ queryKey: queryKeys.peerKeys(MATCH), exact: true }])
  })

  test('MatchClosed marca el match como cerrado y refresca la lista; MatchCreated refresca la lista', async () => {
    const { hub, invalidate, queryClient } = setup()
    queryClient.setQueryData<Partial<MatchSummary>>(queryKeys.match(MATCH), { id: MATCH, status: 'active' })

    hub.emit('MatchClosed', { matchId: MATCH })
    await flush()
    expect(queryClient.getQueryData<MatchSummary>(queryKeys.match(MATCH))?.status).toBe('closed')

    hub.emit('MatchCreated', { matchId: 'm-2' })
    await flush()
    expect(exactKeys(invalidate)).toEqual([
      { queryKey: queryKeys.matches, exact: true },
      { queryKey: queryKeys.matches, exact: true },
    ])
  })

  test('ignora payloads mal formados', async () => {
    const { hub, invalidate } = setup()
    hub.emit('MessageAvailable', { matchId: MATCH, id: 'x', seq: '7' })
    hub.emit('PeerKeyChanged', { userId: 'u' })
    hub.emit('MatchClosed', null)
    await flush()
    expect(invalidate).not.toHaveBeenCalled()
  })

  test('start/stop encadenados: un solo start aunque AppState dispare dos veces, y resync al conectar', async () => {
    const { hub, realtime, invalidate } = setup()
    await Promise.all([realtime.start(), realtime.start()])
    expect(hub.conn.start).toHaveBeenCalledTimes(1)
    expect(hub.conn.state).toBe(HubConnectionState.Connected)
    expect(exactKeys(invalidate)).toContainEqual({ queryKey: queryKeys.matches, exact: true })

    await realtime.stop()
    expect(hub.conn.stop).toHaveBeenCalledTimes(1)
    await realtime.stop()
    expect(hub.conn.stop).toHaveBeenCalledTimes(1)
  })

  test('si start falla (sin red) no rompe: se reintenta en el próximo start', async () => {
    const { hub, realtime } = setup()
    hub.conn.start.mockImplementationOnce(async () => {
      throw new Error('offline')
    })
    await expect(realtime.start()).resolves.toBeUndefined()
    await realtime.start()
    expect(hub.conn.start).toHaveBeenCalledTimes(2)
  })

  test('al reconectar resincroniza la lista y las conversaciones en memoria', async () => {
    const { hub, invalidate } = setup()
    hub.reconnect()
    await flush()
    const calls = exactKeys(invalidate) as { queryKey?: unknown; predicate?: unknown }[]
    expect(calls[0]).toEqual({ queryKey: queryKeys.matches, exact: true })
    expect(typeof calls[1].predicate).toBe('function')
  })
})
