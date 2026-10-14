import { api } from './client'
import type {
  AuthResponse,
  BlockedUser,
  Dna,
  EventSummary,
  Genre,
  KeyBundle,
  LegalCurrent,
  LikeResult,
  LoginRequest,
  MatchSummary,
  Me,
  MessagePage,
  OutgoingMessage,
  PeerKeyBundle,
  RadarPerson,
  RegisterRequest,
  ReportRequest,
  SentMessage,
  Song,
  SpotifyImportRequest,
  SwipeDirection,
  SwipeResult,
  UpdateMeRequest,
} from './types'

const id = (value: string) => encodeURIComponent(value)

export const authApi = {
  legal: () => api<LegalCurrent>('GET', '/legal/current', { auth: false }),
  register: (body: RegisterRequest) => api<AuthResponse>('POST', '/auth/register', { body, auth: false }),
  login: (body: LoginRequest) => api<AuthResponse>('POST', '/auth/login', { body, auth: false }),
  logout: (refreshToken: string) => api<void>('POST', '/auth/logout', { body: { refreshToken }, auth: false }),
}

export const meApi = {
  get: () => api<Me>('GET', '/me'),
  update: (body: UpdateMeRequest) => api<Me>('PATCH', '/me', { body }),
  remove: () => api<void>('DELETE', '/me'),
  dna: () => api<Dna>('GET', '/me/dna'),
  importSpotify: (body: SpotifyImportRequest) => api<Dna>('POST', '/me/spotify/import', { body }),
}

export const catalogApi = {
  genres: () => api<Genre[]>('GET', '/genres'),
  feed: (limit = 20) => api<Song[]>('GET', '/songs/feed', { query: { limit } }),
  swipe: (songId: string, direction: SwipeDirection) =>
    api<SwipeResult>('POST', '/swipes', { body: { songId, direction } }),
}

export const eventsApi = {
  list: (city?: string) => api<EventSummary[]>('GET', '/events', { query: { city } }),
  attend: (eventId: string) => api<void>('PUT', `/events/${id(eventId)}/attendance`),
  unattend: (eventId: string) => api<void>('DELETE', `/events/${id(eventId)}/attendance`),
  radar: (eventId: string) => api<RadarPerson[]>('GET', `/events/${id(eventId)}/radar`),
}

export const matchesApi = {
  like: (targetUserId: string, eventId?: string) =>
    api<LikeResult>('POST', '/likes', { body: { targetUserId, eventId } }),
  list: () => api<MatchSummary[]>('GET', '/matches'),
  unmatch: (matchId: string) => api<void>('DELETE', `/matches/${id(matchId)}`),
}

export const keysApi = {
  publish: (bundle: KeyBundle) => api<void>('PUT', '/keys/me', { body: bundle }),
  mine: () => api<KeyBundle>('GET', '/keys/me'),
  peer: (matchId: string) => api<PeerKeyBundle>('GET', `/matches/${id(matchId)}/peer-keys`),
  peerBox: (matchId: string, boxKeyId: number) =>
    api<PeerKeyBundle>('GET', `/matches/${id(matchId)}/peer-keys/box/${boxKeyId}`),
}

export const chatApi = {
  send: (matchId: string, message: OutgoingMessage) =>
    api<SentMessage>('POST', `/matches/${id(matchId)}/messages`, { body: message }),
  page: (matchId: string, cursor: { before?: number; after?: number }, limit = 50) =>
    api<MessagePage>('GET', `/matches/${id(matchId)}/messages`, { query: { ...cursor, limit } }),
}

export const safetyApi = {
  block: (userId: string) => api<void>('POST', '/blocks', { body: { userId } }),
  blocks: () => api<BlockedUser[]>('GET', '/blocks'),
  unblock: (userId: string) => api<void>('DELETE', `/blocks/${id(userId)}`),
  report: (body: ReportRequest) => api<void>('POST', '/reports', { body }),
}

export const devicesApi = {
  registerPush: (token: string, platform: 'android' | 'ios') =>
    api<void>('PUT', '/devices/push-token', { body: { token, platform } }),
  unregisterPush: (token: string) => api<void>('DELETE', '/devices/push-token', { body: { token } }),
}
