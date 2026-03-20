// Spotify Web API Client
// OAuth PKCE flow + Audio Features + Recently Played

import Constants from 'expo-constants';

const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';
const SPOTIFY_API = 'https://api.spotify.com/v1';

const CLIENT_ID: string =
  (Constants.expoConfig?.extra?.spotifyClientId as string) ?? '';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface SpotifyUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  country: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[] };
  popularity: number;
  explicit: boolean;
  duration_ms: number;
  preview_url: string | null;
}

export interface AudioFeature {
  id: string;
  energy: number;        // 0–1
  danceability: number;  // 0–1
  valence: number;       // 0–1
  tempo: number;         // BPM
  acousticness: number;  // 0–1
  instrumentalness: number; // 0–1
}

export interface VibeVector {
  energy: number;       // avg energy of top tracks
  danceability: number; // avg danceability
  valence: number;      // avg valence (happyness)
  tempo: number;        // avg tempo normalized 0–1
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error('Token refresh failed');

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in,
  };
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function spotifyGet<T>(endpoint: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const status = res.status;
    const body = await res.text();
    throw Object.assign(new Error(`Spotify API ${status}: ${body}`), { status });
  }

  return res.json();
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function getCurrentUser(accessToken: string): Promise<SpotifyUser> {
  const data = await spotifyGet<any>('/me', accessToken);
  return {
    id: data.id,
    name: data.display_name ?? 'Usuario',
    email: data.email ?? '',
    avatar: data.images?.[0]?.url ?? null,
    country: data.country ?? '',
  };
}

export async function getTopTracks(
  accessToken: string,
  limit = 5
): Promise<SpotifyTrack[]> {
  const data = await spotifyGet<any>(
    `/me/top/tracks?limit=${limit}&time_range=short_term`,
    accessToken
  );
  return (data.items ?? []).map((t: any) => t as SpotifyTrack);
}

// ─── Recommendations (for Swipe) ──────────────────────────────────────────────

export async function getRecommendations(
  accessToken: string,
  seedTracks: string[],
  limit = 20
): Promise<SpotifyTrack[]> {
  if (!seedTracks || seedTracks.length === 0) return [];
  const seeds = seedTracks.slice(0, 5).join(','); // Max 5 seeds allowed
  
  try {
    const data = await spotifyGet<any>(
      `/recommendations?limit=${limit}&seed_tracks=${seeds}`,
      accessToken
    );
    
    // Filter out tracks without preview_url if we specifically need audio previews
    // but for now let's just return what Spotify gives us. 
    // We'll handle null preview_url in the UI.
    return (data.tracks ?? []).map((t: any) => t as SpotifyTrack);
  } catch (err: any) {
    console.error('[SpotifyAPI] getRecommendations error:', err.message);
    // If it fails with 404 or 400, return an empty array so UI handles it gracefully
    return [];
  }
}

// ─── Recently Played ──────────────────────────────────────────────────────────

export async function getRecentlyPlayed(
  accessToken: string,
  limit = 50
): Promise<SpotifyTrack[]> {
  const data = await spotifyGet<any>(
    `/me/player/recently-played?limit=${limit}`,
    accessToken
  );
  return (data.items ?? []).map((item: any) => item.track as SpotifyTrack);
}

// ─── Audio Features ───────────────────────────────────────────────────────────

export async function getAudioFeatures(
  accessToken: string,
  trackIds: string[]
): Promise<AudioFeature[]> {
  if (trackIds.length === 0) return [];

  // Spotify allows max 100 ids per request
  const chunks: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    chunks.push(trackIds.slice(i, i + 100));
  }

  const results: AudioFeature[] = [];
  for (const chunk of chunks) {
    const ids = chunk.join(',');
    const data = await spotifyGet<any>(`/audio-features?ids=${ids}`, accessToken);
    results.push(...(data.audio_features ?? []).filter(Boolean));
  }
  return results;
}

// ─── Compute Vibe Vector ──────────────────────────────────────────────────────

/**
 * Computes a 4D VibeVector from the user's recently played tracks.
 *
 * PRIMARY: Spotify Audio Features (energy, danceability, valence, tempo)
 * FALLBACK (403 / deprecated): popularity + tempo + explicit metadata
 */
export async function computeVibeVector(
  accessToken: string
): Promise<{ vector: VibeVector; usedFallback: boolean }> {
  const tracks = await getRecentlyPlayed(accessToken, 50);

  if (tracks.length === 0) {
    return {
      vector: { energy: 0.5, danceability: 0.5, valence: 0.5, tempo: 0.5 },
      usedFallback: false,
    };
  }

  const uniqueIds = [...new Set(tracks.map((t) => t.id))];

  // ── Try audio-features (may 403 for new apps) ──────────────────────────────
  try {
    const features = await getAudioFeatures(accessToken, uniqueIds);

    if (features.length === 0) throw new Error('No features returned');

    const avg = (key: keyof AudioFeature): number =>
      features.reduce((sum, f) => sum + (f[key] as number), 0) / features.length;

    const vector: VibeVector = {
      energy: avg('energy'),
      danceability: avg('danceability'),
      valence: avg('valence'),
      tempo: Math.min(avg('tempo') / 200, 1), // normalize BPM to 0–1
    };

    return { vector, usedFallback: false };
  } catch (e: any) {
    // ── Fallback for 403 (audio-features deprecated for new apps) ────────────
    console.warn('[Encorely] Audio Features 403 — usando fallback de metadata:', e?.message);

    const fallbackVector: VibeVector = {
      // popularity-based energy proxy
      energy: tracks.reduce((s, t) => s + (t.popularity / 100) * 0.3, 0) / tracks.length,
      // use explicit as rough danceability proxy
      danceability:
        tracks.reduce((s, t) => s + (t.explicit ? 0.75 : 0.45), 0) / tracks.length,
      // mid valence (no data without audio-features)
      valence: 0.5,
      // can't know tempo without audio-features — use mid
      tempo: 0.5,
    };

    return { vector: fallbackVector, usedFallback: true };
  }
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

export function cosineSimilarity(a: VibeVector, b: VibeVector): number {
  const va = [a.energy, a.danceability, a.valence, a.tempo];
  const vb = [b.energy, b.danceability, b.valence, b.tempo];

  const dot = va.reduce((acc, val, i) => acc + val * vb[i], 0);
  const magA = Math.sqrt(va.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vb.reduce((acc, val) => acc + val * val, 0));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
