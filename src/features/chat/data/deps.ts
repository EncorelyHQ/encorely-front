import { randomUUID } from 'expo-crypto'
import { chatAckApi, chatApi, keysApi, matchesApi } from '@/lib/api/endpoints'
import type {
  HistoricalBoxKey,
  KeyBundle,
  MatchSummary,
  MessagePage,
  OutgoingMessage,
  PeerKeyBundle,
  SentMessage,
} from '@/lib/api/types'
import { deviceKeys, expoSecretStore, peerKeys, type DeviceKeys, type PeerKeyStore } from '../keys'
import { createLocalStores, type LocalStores } from '../local/registry'
import { createSqliteStoreProvider } from '../local/sqliteStore'

// Todo lo que el chat necesita de afuera, inyectable: los tests corren dos usuarios con llaves en
// memoria contra un servidor falso, con la misma lógica que la app.
export type ChatTransport = {
  match: (matchId: string) => Promise<MatchSummary>
  matches: () => Promise<MatchSummary[]>
  myKeys: () => Promise<PeerKeyBundle>
  publishKeys: (bundle: KeyBundle) => Promise<unknown>
  peerKeys: (matchId: string) => Promise<PeerKeyBundle>
  peerBox: (matchId: string, boxKeyId: number) => Promise<HistoricalBoxKey>
  page: (matchId: string, cursor: { before?: number; after?: number }, limit: number) => Promise<MessagePage>
  send: (matchId: string, message: OutgoingMessage) => Promise<SentMessage>
  ack: (matchId: string, upToSeq: number) => Promise<unknown>
}

export type ChatDeps = {
  transport: ChatTransport
  deviceKeys: DeviceKeys
  peerKeys: PeerKeyStore
  // Historial local cifrado. Sin él (o si la base no abre) el chat funciona como en v1: solo servidor.
  local?: LocalStores
  // UUID canónico: el id entra al AAD y al franking, y sealMessage rechaza cualquier otro formato.
  newId: () => string
  now: () => number
}

export const defaultChatDeps: ChatDeps = {
  transport: {
    match: matchesApi.get,
    matches: matchesApi.list,
    myKeys: keysApi.mine,
    publishKeys: keysApi.publish,
    peerKeys: keysApi.peer,
    peerBox: keysApi.peerBox,
    page: chatApi.page,
    send: chatApi.send,
    ack: chatAckApi.ack,
  },
  deviceKeys,
  peerKeys,
  local: createLocalStores(createSqliteStoreProvider(expoSecretStore)),
  newId: () => randomUUID(),
  now: () => Date.now(),
}
