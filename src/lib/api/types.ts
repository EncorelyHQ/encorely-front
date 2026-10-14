// Tipos del contrato v1. Mientras el back publica contracts/openapi.v1.json se escriben a mano siguiendo
// el acuerdo; cuando exista, `pnpm gen:api` genera schema.d.ts y estos tipos pasan a ser alias de él.

export type Role = 'user' | 'admin'

export type SessionUser = {
  id: string
  email: string
  displayName: string
  onboardingCompleted: boolean
  role: Role
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: SessionUser
}

export type RegisterRequest = {
  email: string
  password: string
  displayName: string
  acceptTerms: boolean
  consentVersion: string
}

export type LoginRequest = { email: string; password: string }

export type LegalCurrent = { version: string; termsUrl?: string | null; privacyUrl?: string | null }

export type Me = {
  id: string
  email: string
  displayName: string
  birthDate: string | null
  age: number | null
  city: string | null
  genres: string[]
  bio?: string | null
  onboardingCompleted: boolean
  role: Role
}

export type UpdateMeRequest = Partial<{
  displayName: string
  birthDate: string
  city: string
  genres: string[]
  bio: string | null
}>

export type Genre = { id: string; slug: string; name: string }

export type Song = {
  id: string
  title: string
  artist: string
  genre: string
  coverUrl: string
  previewUrl: string | null
}

export type SwipeDirection = 'like' | 'dislike'
export type SwipeResult = { counted: boolean; swipeCount: number }

export type Dna = {
  genres: { genre: string; weight: number }[]
  swipeCount: number
  radarThreshold: number
  radarUnlocked: boolean
}

export type EventSummary = {
  id: string
  name: string
  artistLineup: string
  venue: string
  city: string
  startsAt: string
  imageUrl?: string | null
  attendeeCount: number
  iAmGoing: boolean
}

export type RadarPerson = {
  userId: string
  displayName: string
  age: number | null
  city: string | null
  affinity: number
  sharedGenres: string[]
  likedByMe: boolean
  matched: boolean
}

export type LikeResult = { matched: boolean; matchId?: string | null }

export type MatchSummary = {
  id: string
  status: 'active' | 'closed'
  peer: { id: string; displayName: string }
  eventName?: string | null
  sharedGenres: string[]
  createdAt: string
  lastMessageAt?: string | null
}

export type KeyBundle = {
  identityKey: string
  boxKey: string
  boxKeyId: number
  boxKeySig: string
}

export type PeerKeyBundle = KeyBundle & { userId: string; updatedAt: string }

export type OutgoingMessage = {
  id: string
  version: number
  senderBoxKeyId: number
  recipientBoxKeyId: number
  nonce: string
  ciphertext: string
  frankingTag?: string
}

export type SentMessage = { id: string; seq: number; createdAt: string }

export type StoredMessage = OutgoingMessage & {
  seq: number
  senderId: string
  createdAt: string
}

export type MessagePage = { items: StoredMessage[]; nextCursor: number | null }

export type BlockedUser = { userId: string; displayName: string; blockedAt: string }

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fakeProfile' | 'underage' | 'other'

export type ReportRequest = {
  userId: string
  reason: ReportReason
  detail?: string
  matchId?: string
  evidence?: { messageId: string; plaintext: string; frankingKey: string }[]
}

export type SpotifyImportRequest = { topArtists: { name: string; genres: string[] }[] }
