// Tipos y enums espejo del backend Encorely (.NET).

/** Respuesta de los endpoints de Auth (spotify/google/register/login). */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiration: string; // ISO datetime
  userId: string; // GUID — identidad del backend
}

/** GET /User/me — provider y mood vienen como string. */
export interface BackendUser {
  id: string;
  displayName: string;
  email: string;
  provider: 'Spotify' | 'Google' | 'Custom' | string;
  swipeCount: number;
  mood: 'Moshpit' | 'Chill' | 'VIP' | string;
}

/** GET /Swipes/next-track */
export interface NextTrack {
  spotifyId: string;
  name: string;
  artist: string;
  previewUrl: string | null;
}

/** GET /Events/feed */
export interface EventItem {
  id: string;
  name: string;
  venue: string;
  date: string;
  mood: string;
  affiliatePurchaseUrl: string;
}

/** GET /Events/{eventId}/matches — `mood` llega como número (enum sin string converter). */
export interface RadarMatch {
  id: string;
  displayName: string;
  affinity: number; // 0–100
  isHighPriority: boolean;
  mood: number | string;
}

/**
 * Mensaje de chat / venue. El backend NO siempre devuelve todos los campos:
 * - GET /Chat/{roomId}/messages -> { senderId, content, timestamp }
 * - POST /Chat/{matchId}/messages -> { id, content, timestamp }
 */
export interface ChatMessage {
  id?: string;
  matchId?: string;
  roomId?: string;
  senderId?: string;
  content: string;
  timestamp: string;
  isModerated?: boolean;
}

/** GET /Matches/pending -> { matchId, displayName, compatibility }. */
export interface PendingMatch {
  matchId: string;
  displayName: string;
  compatibility: number; // AffinityScore (0–100)
}

export interface AcceptMatchResponse {
  roomId: string;
}

// ---- Enums espejo del backend (se envían como número en los bodies) ----

/** ConcertMood: backend int 0/1/2. */
export enum ConcertMood {
  Moshpit = 0,
  Chill = 1,
  VIP = 2,
}

/** SwipeDirection: backend enum Left=0, Right=1, Down=2. */
export enum SwipeDirection {
  Dislike = 0, // Left
  Like = 1, // Right
  Superlike = 2, // Down
}

export function moodStringToEnum(mood: string): ConcertMood {
  switch (mood) {
    case 'Moshpit':
      return ConcertMood.Moshpit;
    case 'VIP':
      return ConcertMood.VIP;
    case 'Chill':
    default:
      return ConcertMood.Chill;
  }
}

export function moodEnumToString(mood: number | string): 'Moshpit' | 'Chill' | 'VIP' {
  if (typeof mood === 'string') return (mood as any) || 'Chill';
  return mood === 0 ? 'Moshpit' : mood === 2 ? 'VIP' : 'Chill';
}
