import { api } from './client'
import type {
  AuthResponse,
  BlockedUser,
  Dna,
  EventSummary,
  Genre,
  HistoricalBoxKey,
  DataExport,
  DeleteMeRequest,
  DevicePlatform,
  ReportCreated,
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
  SpotifyAuthResponse,
  SpotifyGrant,
  SpotifyImportRequest,
  SpotifyLoginRequest,
  SwipeDirection,
  SwipeResult,
  UpdateMeRequest,
} from './types'

const id = (value: string) => encodeURIComponent(value)

export const authApi = {
  legal: () => api<LegalCurrent>('GET', '/legal/current', { auth: false }),
  register: (body: RegisterRequest) => api<AuthResponse>('POST', '/auth/register', { body, auth: false }),
  login: (body: LoginRequest) => api<AuthResponse>('POST', '/auth/login', { body, auth: false }),
  spotify: (body: SpotifyLoginRequest) => api<SpotifyAuthResponse>('POST', '/auth/spotify', { body, auth: false }),
  logout: (refreshToken: string) => api<void>('POST', '/auth/logout', { body: { refreshToken }, auth: false }),
}

export const meApi = {
  get: () => api<Me>('GET', '/me'),
  update: (body: UpdateMeRequest) => api<Me>('PATCH', '/me', { body }),
  // Exactamente uno: la contraseña actual o, si la cuenta no tiene, un grant nuevo del Spotify vinculado.
  remove: (body: DeleteMeRequest) => api<void>('DELETE', '/me', { body }),
  export: () => api<DataExport>('GET', '/me/export'),
  consent: (version: string) => api<void>('POST', '/me/consents', { body: { version } }),
  dna: () => api<Dna>('GET', '/me/dna'),
  importSpotify: (body: SpotifyImportRequest) => api<Dna>('POST', '/me/spotify/import', { body }),
  linkSpotify: (body: SpotifyGrant) => api<void>('POST', '/me/spotify/link', { body }),
  unlinkSpotify: () => api<void>('DELETE', '/me/spotify/link'),
}

export const catalogApi = {
  genres: () => api<Genre[]>('GET', '/genres'),
  feed: (limit = 20) => api<Song[]>('GET', '/songs/feed', { query: { limit } }),
  swipe: (songId: string, direction: SwipeDirection) =>
    api<SwipeResult>('POST', '/swipes', { body: { songId, direction } }),
}

export const eventsApi = {
  list: (city?: string) => api<EventSummary[]>('GET', '/events', { query: { city } }),
  get: (eventId: string) => api<EventSummary>('GET', `/events/${id(eventId)}`),
  mine: () => api<EventSummary[]>('GET', '/me/events'),
  // Devuelven el evento actualizado (asistencia y conteo reales) para reemplazar la caché sin refetch.
  attend: (eventId: string) => api<EventSummary>('PUT', `/events/${id(eventId)}/attendance`),
  unattend: (eventId: string) => api<EventSummary>('DELETE', `/events/${id(eventId)}/attendance`),
  radar: (eventId: string) => api<RadarPerson[]>('GET', `/events/${id(eventId)}/radar`),
}

export const matchesApi = {
  like: (targetUserId: string, eventId?: string) =>
    api<LikeResult>('POST', '/likes', { body: { targetUserId, eventId } }),
  list: () => api<MatchSummary[]>('GET', '/matches'),
  get: (matchId: string) => api<MatchSummary>('GET', `/matches/${id(matchId)}`),
  unmatch: (matchId: string) => api<void>('DELETE', `/matches/${id(matchId)}`),
}

export const keysApi = {
  publish: (bundle: KeyBundle) => api<void>('PUT', '/keys/me', { body: bundle }),
  mine: () => api<PeerKeyBundle>('GET', '/keys/me'),
  peer: (matchId: string) => api<PeerKeyBundle>('GET', `/matches/${id(matchId)}/peer-keys`),
  peerBox: (matchId: string, boxKeyId: number) =>
    api<HistoricalBoxKey>('GET', `/matches/${id(matchId)}/peer-keys/box/${boxKeyId}`),
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
  report: (body: ReportRequest) => api<ReportCreated>('POST', '/reports', { body }),
}

export const devicesApi = {
  registerPush: (token: string, platform: DevicePlatform) =>
    api<void>('PUT', '/devices/push-token', { body: { token, platform } }),
  unregisterPush: (token: string) => api<void>('DELETE', '/devices/push-token', { body: { token } }),
}

// Panel de administración (v2). El back confirma el rol admin en BD en cada request (403 si no).
type AdminSchemas = import('./schema').components['schemas']

export const adminApi = {
  events: (includePast = true) =>
    api<AdminSchemas['AdminEventDto'][]>('GET', '/admin/events', { query: { includePast: String(includePast) } }),
  createEvent: (body: AdminSchemas['AdminEventRequest']) =>
    api<AdminSchemas['AdminEventDto']>('POST', '/admin/events', { body }),
  updateEvent: (eventId: string, body: AdminSchemas['AdminEventRequest']) =>
    api<AdminSchemas['AdminEventDto']>('PUT', `/admin/events/${id(eventId)}`, { body }),
  deleteEvent: (eventId: string) => api<void>('DELETE', `/admin/events/${id(eventId)}`),
  songs: (limit = 200) => api<AdminSchemas['AdminSongDto'][]>('GET', '/admin/songs', { query: { limit } }),
  createSong: (body: AdminSchemas['AdminSongRequest']) =>
    api<AdminSchemas['AdminSongDto']>('POST', '/admin/songs', { body }),
  updateSong: (songId: string, body: AdminSchemas['AdminSongRequest']) =>
    api<AdminSchemas['AdminSongDto']>('PUT', `/admin/songs/${id(songId)}`, { body }),
  searchITunes: (term: string) =>
    api<AdminSchemas['ITunesTrackDto'][]>('GET', '/admin/itunes/search', { query: { term } }),
  reports: (status: AdminSchemas['ReportStatus']) =>
    api<AdminSchemas['AdminReportDto'][]>('GET', '/admin/reports', { query: { status } }),
  resolveReport: (reportId: string, body: AdminSchemas['ResolveReportRequest']) =>
    api<AdminSchemas['AdminReportDto']>('POST', `/admin/reports/${id(reportId)}/resolve`, { body }),
  setUserStatus: (userId: string, status: AdminSchemas['UserStatus']) =>
    api<void>('PUT', `/admin/users/${id(userId)}/status`, { body: { status } }),
}

// Sesiones abiertas (una por dispositivo con sesión). DELETE /me/sessions cierra TODAS, incluida la de este teléfono.
export type AccountSession = import('./schema').components['schemas']['SessionDto']

export const accountApi = {
  sessions: () => api<AccountSession[]>('GET', '/me/sessions'),
  revokeSession: (sessionId: string) => api<void>('DELETE', `/me/sessions/${id(sessionId)}`),
  revokeAllSessions: () => api<void>('DELETE', '/me/sessions'),
}

// --- Chat v1.1/v2: historial local (ack), respaldo cifrado y traspaso de llaves (contrato draft.3) ---
type SyncSchemas = import('./schema').components['schemas']
export type BackupInfo = SyncSchemas['BackupInfoDto']
export type BackupBlob = SyncSchemas['BackupDto']
export type PutBackupRequest = SyncSchemas['PutBackupRequest']
export type LinkRequest = SyncSchemas['LinkRequestDto']
export type FulfillLinkRequest = SyncSchemas['FulfillLinkRequest']

export const chatAckApi = {
  // El servidor borra lo que el otro me envió hasta upToSeq: llamar solo con eso ya guardado en el teléfono.
  ack: (matchId: string, upToSeq: number) =>
    api<void>('POST', `/matches/${id(matchId)}/messages/ack`, { body: { upToSeq } }),
}

export const backupApi = {
  info: () => api<BackupInfo>('GET', '/me/backup/info'),
  get: () => api<BackupBlob>('GET', '/me/backup', { timeoutMs: 120_000 }),
  put: (body: PutBackupRequest) => api<BackupInfo>('PUT', '/me/backup', { body, timeoutMs: 120_000 }),
  remove: () => api<void>('DELETE', '/me/backup'),
}

export const linkApi = {
  create: (ephemeralKey: string) => api<LinkRequest>('POST', '/keys/link-requests', { body: { ephemeralKey } }),
  get: (linkId: string) => api<LinkRequest>('GET', `/keys/link-requests/${id(linkId)}`),
  fulfill: (linkId: string, body: FulfillLinkRequest) =>
    api<void>('PUT', `/keys/link-requests/${id(linkId)}`, { body }),
  remove: (linkId: string) => api<void>('DELETE', `/keys/link-requests/${id(linkId)}`),
}
