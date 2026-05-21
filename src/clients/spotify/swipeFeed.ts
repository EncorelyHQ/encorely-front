import { getTopTracks } from '@/clients/spotify/spotifyApi';
import {
  SPOTIFY_API_BASE,
  SPOTIFY_FALLBACK_PLAYLIST_ID,
  SPOTIFY_SWIPE_MARKET,
  SPOTIFY_SWIPE_MIN_VALID_TRACKS,
} from '@/config/spotify';

export interface SwipeTrack {
  id: string;
  name: string;
  artistName: string;
  imageUrl: string;
  previewUrl: string | null;
}

async function fetchRecommendations(
  token: string,
  seedArtists: string[],
  seedGenres: string[] = ['pop', 'electronic']
): Promise<any[]> {
  const params = new URLSearchParams({
    limit: '20',
    market: SPOTIFY_SWIPE_MARKET,
  });

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

  const res = await fetch(`${SPOTIFY_API_BASE}/recommendations?${params.toString()}`, {
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
    `${SPOTIFY_API_BASE}/me/top/tracks?limit=50&time_range=medium_term`,
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
  try {
    const res = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${SPOTIFY_FALLBACK_PLAYLIST_ID}/tracks?limit=30&market=${SPOTIFY_SWIPE_MARKET}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      console.warn(`[SwipeService] /playlists fallback failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    console.log('📦 Tracks response (fallback playlist):', data?.items?.length ?? 0);
    return (data?.items || []).map((item: any) => item.track).filter(Boolean);
  } catch (e) {
    console.warn('[SwipeService] Playlist fallback error:', e);
    return [];
  }
}

async function fetchGenericSearch(token: string): Promise<any[]> {
  const genres = ['pop', 'rock', 'latin', 'reggaeton', 'hip-hop', 'electronic', 'indie'];
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];

  try {
    const res = await fetch(
      `${SPOTIFY_API_BASE}/search?q=genre%3A${randomGenre}&type=track&limit=30&market=${SPOTIFY_SWIPE_MARKET}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      console.warn(`[SwipeService] /search fallback failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data?.tracks?.items || [];
    console.log(`📦 Tracks response (search "${randomGenre}"):`, items.length);
    return items;
  } catch (e) {
    console.warn('[SwipeService] Search fallback error:', e);
    return [];
  }
}

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

export const spotifySwipeService = {
  getSwipeBatch: async (accessToken: string): Promise<SwipeTrack[]> => {
    console.log('🔑 Token:', accessToken ? 'OK' : 'MISSING');

    if (!accessToken) return [];

    try {
      let seedArtistIds: string[] = [];
      try {
        const topTracks = await getTopTracks(accessToken, 10);
        seedArtistIds = [...new Set(topTracks.flatMap((t) => t.artists.map((a) => a.id)))];
      } catch (e) {
        console.warn('[SwipeService] Could not fetch top tracks for seeds:', e);
      }

      let allValid: SwipeTrack[] = [];
      let allMapped: SwipeTrack[] = [];

      // Attempt 1: Recommendations
      console.log('[SwipeService] Attempt 1: /recommendations');
      const recTracks = await fetchRecommendations(accessToken, seedArtistIds);
      let mapped = mapToSwipeTracks(recTracks);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(
        `[SwipeService] After recommendations: ${allValid.length} with preview, ${allMapped.length} total`
      );

      if (allValid.length >= SPOTIFY_SWIPE_MIN_VALID_TRACKS) {
        return allValid.slice(0, 20);
      }

      // Attempt 2: Top Tracks
      console.log('[SwipeService] Attempt 2: /me/top/tracks');
      const topRaw = await fetchTopTracks(accessToken);
      mapped = mapToSwipeTracks(topRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(
        `[SwipeService] After top tracks: ${allValid.length} with preview, ${allMapped.length} total`
      );

      if (allValid.length >= SPOTIFY_SWIPE_MIN_VALID_TRACKS) {
        return allValid.slice(0, 20);
      }

      // Attempt 3: Fallback Playlist
      console.log('[SwipeService] Attempt 3: fallback playlist');
      const playlistRaw = await fetchFallbackPlaylist(accessToken);
      mapped = mapToSwipeTracks(playlistRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(
        `[SwipeService] After fallback playlist: ${allValid.length} with preview, ${allMapped.length} total`
      );

      if (allValid.length >= SPOTIFY_SWIPE_MIN_VALID_TRACKS) {
        return allValid.slice(0, 20);
      }

      // Attempt 4 (NEW): Generic Search as last resort
      console.log('[SwipeService] Attempt 4: generic search fallback');
      const searchRaw = await fetchGenericSearch(accessToken);
      mapped = mapToSwipeTracks(searchRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      console.log(
        `[SwipeService] After search fallback: ${allValid.length} with preview, ${allMapped.length} total`
      );

      if (allValid.length > 0) {
        return allValid.slice(0, 20);
      }

      if (allMapped.length > 0) {
        console.log(
          `[SwipeService] ⚠️ 0 tracks with preview — returning ${allMapped.length} tracks without audio`
        );
        return allMapped.slice(0, 20);
      }

      console.warn('[SwipeService] ⚠️ All 4 attempts returned 0 tracks');
      return [];
    } catch (error: any) {
      console.error('[SwipeService] Fatal error in getSwipeBatch:', error?.message || error);
      return [];
    }
  },
};

