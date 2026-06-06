// Spotify Web API — OAuth token exchange + REST helpers

import {
  SPOTIFY_ACCOUNTS_URL,
  SPOTIFY_API_BASE,
  getSpotifyClientId,
} from '@/config/spotify';
import type { VibeVector } from '@/shared/types/vibe';

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  energy: number;
  danceability: number;
  valence: number;
  tempo: number;
  acousticness: number;
  instrumentalness: number;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: getSpotifyClientId(),
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
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
    client_id: getSpotifyClientId(),
  });

  const res = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
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

async function spotifyGet<T>(endpoint: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const status = res.status;
    const body = await res.text();
    throw Object.assign(new Error(`Spotify API ${status}: ${body}`), { status });
  }

  return res.json();
}

export interface SpotifyArtistSearchItem {
  id: string;
  name: string;
  images: { url: string }[];
}

export async function searchArtists(
  accessToken: string,
  query: string,
  limit = 12
): Promise<SpotifyArtistSearchItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  let parsedLimit = Math.round(Number(limit));
  if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = 12;
  if (parsedLimit > 50) parsedLimit = 50;
  const q = encodeURIComponent(trimmed);
  const data = await spotifyGet<any>(
    `/search?q=${q}&type=artist&limit=${parsedLimit}`,
    accessToken
  );
  return (data.artists?.items ?? [])
    .filter((a: any) => a?.id && a?.name)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      images: a.images ?? [],
    }));
}

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

export async function getTopTracks(accessToken: string, limit = 5): Promise<SpotifyTrack[]> {
  const data = await spotifyGet<any>(
    `/me/top/tracks?limit=${limit}&time_range=short_term`,
    accessToken
  );
  return (data.items ?? []).map((t: any) => t as SpotifyTrack);
}

export async function getRecommendations(
  accessToken: string,
  _seedTracks: string[],
  limit = 20
): Promise<SpotifyTrack[]> {
  try {
    let parsedLimit = Math.round(Number(limit));
    if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = 20;
    if (parsedLimit > 50) parsedLimit = 50;

    const query = encodeURIComponent(`genre:pop`);

    const data = await spotifyGet<any>(
      `/search?q=${query}&type=track&limit=${parsedLimit}`,
      accessToken
    );

    if (!data.tracks || !data.tracks.items) return [];

    return data.tracks.items
      .filter((track: any) => track && track.id)
      .map((track: any) => track as SpotifyTrack);
  } catch {
    return [];
  }
}

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

export async function getAudioFeatures(
  accessToken: string,
  trackIds: string[]
): Promise<AudioFeature[]> {
  if (trackIds.length === 0) return [];

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

  try {
    const features = await getAudioFeatures(accessToken, uniqueIds);

    if (features.length === 0) throw new Error('No features returned');

    const avg = (key: keyof AudioFeature): number => {
      const vals = features.map((f) => Number(f[key])).filter((v) => !isNaN(v));
      if (vals.length === 0) return 0.5;
      return vals.reduce((sum, v) => sum + v, 0) / vals.length;
    };

    const vector: VibeVector = {
      energy: avg('energy'),
      danceability: avg('danceability'),
      valence: avg('valence'),
      tempo: Math.min(avg('tempo') / 200, 1),
    };

    return { vector, usedFallback: false };
  } catch {
    const safe = (val: number, fallback = 0.5) =>
      isNaN(val) || val === null || val === undefined ? fallback : val;

    const fallbackVector: VibeVector = {
      energy: safe(
        tracks.reduce((s, t) => s + ((t.popularity ?? 50) / 100) * 0.3, 0) / tracks.length
      ),
      danceability: safe(
        tracks.reduce((s, t) => s + (t.explicit ? 0.75 : 0.45), 0) / tracks.length
      ),
      valence: 0.5,
      tempo: 0.5,
    };

    return { vector: fallbackVector, usedFallback: true };
  }
}
