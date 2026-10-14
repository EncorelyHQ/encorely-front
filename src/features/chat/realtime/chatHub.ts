import {
  HttpTransportType,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
  type ILogger,
} from '@microsoft/signalr'
import type { QueryClient } from '@tanstack/react-query'
import { getValidAccessToken } from '@/lib/api/client'
import type { MatchSummary } from '@/lib/api/types'
import { HUB_URL } from '@/lib/config'
import { queryKeys } from '@/lib/query'
import type { ConversationData } from '../data/messages'

export type ChatHubEvent =
  | { type: 'MessageAvailable'; matchId: string; id: string; seq: number }
  | { type: 'PeerKeyChanged'; matchId: string; userId: string }
  | { type: 'MatchClosed'; matchId: string }
  | { type: 'MatchCreated'; matchId: string }

export const HUB_EVENTS = ['MessageAvailable', 'PeerKeyChanged', 'MatchClosed', 'MatchCreated'] as const

// Lo mínimo de HubConnection que usamos: permite probar el cableado con un doble.
export type HubConnectionLike = Pick<HubConnection, 'on' | 'off' | 'start' | 'stop' | 'onreconnected' | 'state'>

// Silencioso a propósito: los logs de transporte de SignalR pueden incluir la URL con access_token.
const silentLogger: ILogger = { log: () => undefined }

export function buildHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL, {
      // Se llama en cada (re)conexión: así un token vencido se renueva antes de reconectar.
      accessTokenFactory: async () => (await getValidAccessToken()) ?? '',
      // En RN solo hay WebSockets nativos; sin negotiate nos ahorramos un round-trip HTTP en cada conexión.
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
      logger: silentLogger,
    })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
    .configureLogging(LogLevel.None)
    .build()
}

const matchesListKey = { queryKey: queryKeys.matches, exact: true } as const

function isMessagesKey(key: readonly unknown[]): boolean {
  return key[0] === 'matches' && key[2] === 'messages' && key.length === 3
}

function parseEvent(type: (typeof HUB_EVENTS)[number], payload: unknown): ChatHubEvent | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.matchId !== 'string' || !p.matchId) return null
  switch (type) {
    case 'MessageAvailable':
      return typeof p.id === 'string' && typeof p.seq === 'number'
        ? { type, matchId: p.matchId, id: p.id, seq: p.seq }
        : null
    case 'PeerKeyChanged':
      return typeof p.userId === 'string' ? { type, matchId: p.matchId, userId: p.userId } : null
    default:
      return { type, matchId: p.matchId }
  }
}

// El socket solo avisa; los datos siempre se traen por REST (fuente de verdad).
export async function handleChatEvent(queryClient: QueryClient, event: ChatHubEvent): Promise<void> {
  switch (event.type) {
    case 'MessageAvailable': {
      // La lista se reordena por lastMessageAt y un match "nuevo" pasa a "conversaciones".
      const list = queryClient.invalidateQueries(matchesListKey)
      const key = queryKeys.messages(event.matchId)
      const data = queryClient.getQueryData<ConversationData>(key)
      // Sin conversación en memoria no hay nada que agregar: se cargará al abrirla.
      if (!data) return list
      if (data.newestSeq !== null && event.seq <= data.newestSeq) return list
      // El queryFn de la conversación, con datos previos, trae solo `after=newestSeq` y lo mezcla por id.
      await Promise.all([list, queryClient.invalidateQueries({ queryKey: key, exact: true })])
      return
    }
    case 'PeerKeyChanged':
      return queryClient.invalidateQueries({ queryKey: queryKeys.peerKeys(event.matchId), exact: true })
    case 'MatchClosed':
      queryClient.setQueryData<MatchSummary>(queryKeys.match(event.matchId), (match) =>
        match ? { ...match, status: 'closed' } : match,
      )
      return queryClient.invalidateQueries(matchesListKey)
    case 'MatchCreated':
      return queryClient.invalidateQueries(matchesListKey)
  }
}

// Tras reconectar pudo perderse cualquier aviso: se resincroniza todo lo visible por REST.
export async function resyncChat(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries(matchesListKey),
    queryClient.invalidateQueries({ predicate: (q) => isMessagesKey(q.queryKey) }),
  ])
}

type RealtimeOptions = {
  connection: HubConnectionLike
  queryClient: QueryClient
}

export function createChatRealtime({ connection, queryClient }: RealtimeOptions) {
  for (const type of HUB_EVENTS) {
    connection.on(type, (payload: unknown) => {
      const event = parseEvent(type, payload)
      if (!event) return
      // Un refetch fallido queda en el estado de su query (y se reintenta al volver a la app): no hay más que hacer aquí.
      handleChatEvent(queryClient, event).catch(() => undefined)
    })
  }
  connection.onreconnected(() => {
    resyncChat(queryClient).catch(() => undefined)
  })

  // start/stop se encadenan: AppState puede alternar rápido y SignalR falla si se llama start mientras conecta.
  let queue: Promise<void> = Promise.resolve()
  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task, task)
    return queue
  }

  return {
    start: () =>
      enqueue(async () => {
        if (connection.state !== HubConnectionState.Disconnected) return
        try {
          await connection.start()
        } catch {
          // Sin red o servidor caído: el chat sigue funcionando por REST y se reintenta al volver a la app.
          return
        }
        await resyncChat(queryClient)
      }),
    stop: () =>
      enqueue(async () => {
        if (connection.state === HubConnectionState.Disconnected) return
        await connection.stop().catch(() => undefined)
      }),
    dispose: () => {
      for (const type of HUB_EVENTS) connection.off(type)
    },
  }
}

export type ChatRealtime = ReturnType<typeof createChatRealtime>
