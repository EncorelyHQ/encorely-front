import { getTopTracks } from './spotifyService';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const FALLBACK_PLAYLIST = '37i9dQZF1DXcBWIGoYBM5M'; // Today's Top Hits
const MARKET = 'US'; // US has far more preview_urls available than CO
const MIN_VALID_TRACKS = 5;

export interface SwipeTrack {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string;
  previewUrl: string | null;
}

// ─── Internal fetch helpers ─────────────────────────────────────────────────

async function fetchRecommendations(
  token: string,
  seedArtists: string[],
  seedGenres: string[] = ['pop', 'electronic']
): Promise<any[]> {
  const params = new URLSearchParams({
    limit: '20',
    market: MARKET,
  });

  // Build seeds — Spotify allows max 5 total seeds across all seed_* params
  if (seedArtists.length > 0) {
    params.set('seed_artists', seedArtists.slice(0, 2).join(','));
    params.set('seed_genres', seedGenres.slice(0, 3).join(','));
  } else if (seedGenres.length > 0) {
    params.set('seed_genres', seedGenres.slice(0, 5).join(','));
  }

  console.log('🎵 Seeds:', {
    artists: params.get('seed_artists') || '(none)',
    genres: params.get('seed_genres') || '(none)',
  });

  const res = await fetch(`${SPOTIFY_API}/recommendations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn(`[SwipeService] /recommendations failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  console.log('📦 Tracks response (recommendations):', data?.tracks?.length ?? 0);
  return data?.tracks || [];
}

async function fetchTopTracks(token: string): Promise<any[]> {
  const res = await fetch(
    `${SPOTIFY_API}/me/top/tracks?limit=50&time_range=medium_term`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.warn(`[SwipeService] /me/top/tracks failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  console.log('📦 Tracks response (top tracks):', data?.items?.length ?? 0);
  return data?.items || [];
}

async function fetchFallbackPlaylist(token: string): Promise<any[]> {
  const res = await fetch(
    `${SPOTIFY_API}/playlists/${FALLBACK_PLAYLIST}/tracks?limit=30&market=${MARKET}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.warn(`[SwipeService] /playlists fallback failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  console.log('📦 Tracks response (fallback playlist):', data?.items?.length ?? 0);
  // Playlist endpoint wraps tracks in { track: {...} }
  return (data?.items || []).map((item: any) => item.track).filter(Boolean);
}

// ─── Track mapper ───────────────────────────────────────────────────────────

function mapToSwipeTracks(rawTracks: any[]): SwipeTrack[] {
  return rawTracks
    .filter((t) => t && t.id)
    .map((t) => ({
      id: t.id,
      name: t.name,
      artistName: t.artists?.map((a: any) => a.name).join(', ') || 'Artista Desconocido',
      imageUrl: t.album?.images?.[0]?.url || '',
      previewUrl: t.preview_url || null,
    }));
}

function filterWithPreview(tracks: SwipeTrack[]): SwipeTrack[] {
  return tracks.filter((t) => t.previewUrl !== null);
}

// ─── Main public API ────────────────────────────────────────────────────────

export const spotifySwipeService = {
  getSwipeBatch: async (accessToken: string): Promise<SwipeTrack[]> => {
    console.log('🔑 Token:', accessToken ? 'OK' : 'MISSING');

    if (!accessToken) return [];

    try {
      // ── Gather seeds from user's recent top tracks ──────────────────────
      let seedArtistIds: string[] = [];
      let seedTrackIds: string[] = [];
      try {
        const topTracks = await getTopTracks(accessToken, 10);
        seedArtistIds = [...new Set(topTracks.flatMap((t) => t.artists.map((a) => a.id)))];
        seedTrackIds = topTracks.map((t) => t.id).slice(0, 5);
      } catch (e) {
        console.warn('[SwipeService] Could not fetch top tracks for seeds:', e);
      }

      // Accumulate tracks with preview AND all tracks across all tiers
      let allValid: SwipeTrack[] = [];
      let allMapped: SwipeTrack[] = []; // fallback: tracks without preview still display (no audio)

      // ── Attempt 1: Spotify Recommendations ──────────────────────────────
      console.log('[SwipeService] Attempt 1: /recommendations');
      const recTracks = await fetchRecommendations(accessToken, seedArtistIds);
      let mapped = mapToSwipeTracks(recTracks);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(`[SwipeService] After recommendations: ${allValid.length} with preview, ${allMapped.length} total`);

      if (allValid.length >= MIN_VALID_TRACKS) {
        return allValid.slice(0, 20);
      }

      // ── Attempt 2: User's top tracks directly ──────────────────────────
      console.log('[SwipeService] Attempt 2: /me/top/tracks');
      const topRaw = await fetchTopTracks(accessToken);
      mapped = mapToSwipeTracks(topRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(`[SwipeService] After top tracks: ${allValid.length} with preview, ${allMapped.length} total`);

      if (allValid.length >= MIN_VALID_TRACKS) {
        return allValid.slice(0, 20);
      }

      // ── Attempt 3: Fallback playlist (Today's Top Hits) ────────────────
      console.log('[SwipeService] Attempt 3: fallback playlist');
      const playlistRaw = await fetchFallbackPlaylist(accessToken);
      mapped = mapToSwipeTracks(playlistRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(`[SwipeService] After fallback playlist: ${allValid.length} with preview, ${allMapped.length} total`);

      if (allValid.length > 0) {
        return allValid.slice(0, 20);
      }

      // ── Ultimate fallback: return tracks WITHOUT preview (cards still work, no audio)
      if (allMapped.length > 0) {
        console.log(`[SwipeService] ⚠️ 0 tracks with preview — returning ${allMapped.length} tracks without audio`);
        return allMapped.slice(0, 20);
      }

      console.warn('[SwipeService] ⚠️ All 3 attempts returned 0 tracks');
      return [];
    } catch (error: any) {
      console.error('[SwipeService] Fatal error in getSwipeBatch:', error?.message || error);
      return [];
    }
  },
};
