// Alias legibles sobre los tipos generados del contrato (../encorly_back/contracts/openapi.v1.json).
// No escribir tipos de API a mano: si el contrato cambia, `pnpm gen:api` y ajustar aquí solo los nombres.
import type { components } from './schema'

type S = components['schemas']

export type Role = S['UserRole']
export type SessionUser = S['AuthUserDto']
export type AuthResponse = S['AuthResponse']
export type RegisterRequest = S['RegisterRequest']
export type LoginRequest = S['LoginRequest']
export type LegalCurrent = S['LegalResponse']
export type SpotifyLoginRequest = S['SpotifyLoginRequest']
export type SpotifyAuthResponse = S['SpotifyAuthResponse']
export type SpotifyGrant = S['SpotifyGrant']

export type Me = S['MeResponse']
export type UpdateMeRequest = S['UpdateMeRequest']
export type DeleteMeRequest = S['DeleteMeRequest']
export type Genre = S['GenreDto']

export type Song = S['SongDto']
export type SwipeDirection = S['SwipeDirection']
export type SwipeResult = S['SwipeResponse']
export type Dna = S['DnaResponse']
export type DnaGenre = S['DnaGenreDto']

export type EventSummary = S['EventDto']
export type RadarPerson = S['RadarEntryDto']

export type LikeResult = S['LikeResponse']
export type MatchSummary = S['MatchDto']
export type MatchStatus = S['MatchStatus']

export type KeyBundle = S['UploadKeysRequest']
export type PeerKeyBundle = S['KeyBundleDto']
export type HistoricalBoxKey = S['BoxKeyDto']

export type OutgoingMessage = S['SendMessageRequest']
export type SentMessage = S['MessageAcceptedDto']
export type StoredMessage = S['MessageDto']
export type MessagePage = S['MessagePage']

export type BlockedUser = S['BlockedUserDto']
export type ReportReason = S['ReportReason']
export type ReportRequest = S['ReportRequest']
export type ReportCreated = S['ReportCreatedDto']

export type SpotifyImportRequest = S['SpotifyImportRequest']
export type SpotifyImportResponse = S['SpotifyImportResponse']
export type DevicePlatform = S['DevicePlatform']
export type DataExport = S['DataExportResponse']

export type PublicProfile = S['PublicProfileDto']
export type ProfileArtist = S['ProfileArtistDto']
export type ProfileGenre = S['ProfileGenreDto']
export type ProfileStats = S['ProfileStatsDto']
export type ReactionType = S['ReactionType']
export type ReactionTargetKind = S['ReactionTargetKind']
export type ReactionRequest = S['ReactionRequest']
export type MyReaction = S['MyReactionDto']
export type ReceivedReactionSummary = S['ReceivedReactionDto']
export type ReceivedReaction = S['ReceivedReactionItemDto']
export type ReceivedReactionPage = S['ReceivedReactionPage']
