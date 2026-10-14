import { randomUUID } from 'expo-crypto'
import { chatApi, keysApi, matchesApi } from '@/lib/api/endpoints'
import type {
  HistoricalBoxKey,
  KeyBundle,
  MatchSummary,
  MessagePage,
  OutgoingMessage,
  PeerKeyBundle,
  SentMessage,
} from '@/lib/api/types'
import { deviceKeys, peerKeys, type DeviceKeys, type PeerKeyStore } from '../keys'

// Todo lo que el chat necesita de afuera, inyectable: los tests corren dos usuarios con llaves en
// memoria contra un servidor falso, con la misma lógica que la app.
export type ChatTransport = {
  match: (matchId: string) => Promise<MatchSummary>
  myKeys: () => Promise<PeerKeyBundle>
  publishKeys: (bundle: KeyBundle) => Promise<unknown>
  peerKeys: (matchId: string) => Promise<PeerKeyBundle>
  peerBox: (matchId: string, boxKeyId: number) => Promise<HistoricalBoxKey>
  page: (matchId: string, cursor: { before?: number; after?: number }, limit: number) => Promise<MessagePage>
  send: (matchId: string, message: OutgoingMessage) => Promise<SentMessage>
}

export type ChatDeps = {
  transport: ChatTransport
  deviceKeys: DeviceKeys
  peerKeys: PeerKeyStore
  // UUID canónico: el id entra al AAD y al franking, y sealMessage rechaza cualquier otro formato.
  newId: () => string
  now: () => number
}

export const defaultChatDeps: ChatDeps = {
  transport: {
    match: matchesApi.get,
    myKeys: keysApi.mine,
    publishKeys: keysApi.publish,
    peerKeys: keysApi.peer,
    peerBox: keysApi.peerBox,
    page: chatApi.page,
    send: chatApi.send,
  },
  deviceKeys,
  peerKeys,
  newId: () => randomUUID(),
  now: () => Date.now(),
}
