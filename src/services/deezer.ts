// Deezer Public API Client
// No API key required for search and track details
// Docs: https://developers.deezer.com/api

const BASE_URL = 'https://api.deezer.com';

export interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  rank: number;
  explicit_lyrics: boolean;
  bpm: number;
  preview: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
}

export interface DeezerArtist {
  id: number;
  name: string;
  picture_medium: string;
  nb_fan?: number;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  cover_medium: string;
  release_date?: string;
  genres?: { data: DeezerGenre[] };
}

export interface DeezerGenre {
  id: number;
  name: string;
  picture: string;
}

export interface DeezerSearchResult {
  data: DeezerTrack[];
  total: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Deezer API error: ${res.status}`);
  return res.json();
}

export const deezerApi = {
  /**
   * Search tracks by query string
   */
  searchTracks: (query: string, limit = 8) =>
    get<DeezerSearchResult>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  /**
   * Get full track details (includes bpm, rank, album with genres)
   */
  getTrack: (id: number) =>
    get<DeezerTrack>(`/track/${id}`),

  /**
   * Get artist details
   */
  getArtist: (id: number) =>
    get<DeezerArtist>(`/artist/${id}`),
};
