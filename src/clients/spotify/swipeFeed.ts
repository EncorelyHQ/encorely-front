import { getTopTracks, type SpotifyTrack } from '@/clients/spotify/spotifyApi';
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
): Promise<SpotifyTrack[]> {
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

  const res = await fetch(`${SPOTIFY_API_BASE}/recommendations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data?.tracks as SpotifyTrack[]) || [];
}

async function fetchTopTracks(token: string): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `${SPOTIFY_API_BASE}/me/top/tracks?limit=50&time_range=medium_term`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data?.items as SpotifyTrack[]) || [];
}

async function fetchFallbackPlaylist(token: string): Promise<SpotifyTrack[]> {
  try {
    const res = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${SPOTIFY_FALLBACK_PLAYLIST_ID}/tracks?limit=30&market=${SPOTIFY_SWIPE_MARKET}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return ((data?.items as Array<{ track: SpotifyTrack | null }>) || [])
      .map((item) => item.track)
      .filter((t): t is SpotifyTrack => t !== null);
  } catch {
    return [];
  }
}

async function fetchGenericSearch(token: string): Promise<SpotifyTrack[]> {
  const genres = ['pop', 'rock', 'latin', 'reggaeton', 'hip-hop', 'electronic', 'indie'];
  const randomGenre = genres[Math.floor(Math.random() * genres.length)];

  try {
    const res = await fetch(
      `${SPOTIFY_API_BASE}/search?q=genre%3A${randomGenre}&type=track&limit=30&market=${SPOTIFY_SWIPE_MARKET}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data?.tracks?.items as SpotifyTrack[]) || [];
  } catch {
    return [];
  }
}

function mapToSwipeTracks(rawTracks: SpotifyTrack[]): SwipeTrack[] {
  return rawTracks
    .filter((t) => t && t.id)
    .map((t) => ({
      id: t.id,
      name: t.name,
      artistName: t.artists?.map((a) => a.name).join(', ') || 'Artista Desconocido',
      imageUrl: t.album?.images?.[0]?.url || '',
      previewUrl: t.preview_url || null,
    }));
}

function filterWithPreview(tracks: SwipeTrack[]): SwipeTrack[] {
  return tracks.filter((t) => t.previewUrl !== null);
}

export const spotifySwipeService = {
  getSwipeBatch: async (accessToken: string): Promise<SwipeTrack[]> => {
    if (!accessToken) return [];

    try {
      let seedArtistIds: string[] = [];
      try {
        const topTracks = await getTopTracks(accessToken, 10);
        seedArtistIds = [...new Set(topTracks.flatMap((t) => t.artists.map((a) => a.id)))];
      } catch {
        // seeds unavailable, proceed without them
      }

      let allValid: SwipeTrack[] = [];
      let allMapped: SwipeTrack[] = [];

      const recTracks = await fetchRecommendations(accessToken, seedArtistIds);
      let mapped = mapToSwipeTracks(recTracks);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      if (allValid.length >= SPOTIFY_SWIPE_MIN_VALID_TRACKS) return allValid.slice(0, 20);

      const topRaw = await fetchTopTracks(accessToken);
      mapped = mapToSwipeTracks(topRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      if (allValid.length >= SPOTIFY_SWIPE_MIN_VALID_TRACKS) return allValid.slice(0, 20);

      const playlistRaw = await fetchFallbackPlaylist(accessToken);
      mapped = mapToSwipeTracks(playlistRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));
      if (allValid.length >= SPOTIFY_SWIPE_MIN_VALID_TRACKS) return allValid.slice(0, 20);

      const searchRaw = await fetchGenericSearch(accessToken);
      mapped = mapToSwipeTracks(searchRaw);
      allMapped.push(...mapped);
      allValid.push(...filterWithPreview(mapped));

      if (allValid.length > 0) return allValid.slice(0, 20);
      return allMapped.slice(0, 20);
    } catch {
      return [];
    }
  },
};
