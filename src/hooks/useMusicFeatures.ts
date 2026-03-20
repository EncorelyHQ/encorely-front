import { useState, useCallback } from 'react';
import { deezerApi, DeezerTrack } from '../services/deezer';

/**
 * Vibe Vector: 5-dimensional representation of a user's musical taste.
 * Derived entirely from public Deezer API metadata.
 */
export interface VibeVector {
  tempo: number;        // BPM normalized 0-1 (60-200bpm range)
  popularity: number;   // Track rank normalized 0-1
  era: number;          // Release year normalized 0-1 (1960-2025)
  explicitness: number; // 0 or 1
  genreAffinity: number;// Genre ID hashed to 0-1
}

function normalizeBpm(bpm: number): number {
  if (!bpm || bpm < 60) return 0.3; // default mid-tempo if unknown
  return Math.min(Math.max((bpm - 60) / (200 - 60), 0), 1);
}

function normalizeRank(rank: number): number {
  if (!rank) return 0.5;
  return Math.min(Math.max(rank / 1_000_000, 0), 1);
}

function normalizeYear(dateStr: string | undefined): number {
  if (!dateStr) return 0.5;
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (isNaN(year)) return 0.5;
  return Math.min(Math.max((year - 1960) / (2025 - 1960), 0), 1);
}

function normalizeGenre(genreId: number | undefined): number {
  if (!genreId) return 0.5;
  // Spread genre IDs across 0-1 using modulo
  return (genreId % 100) / 100;
}

export function buildVibeVector(track: DeezerTrack): VibeVector {
  const releaseDate = track.album?.release_date;
  const genreId = track.album?.genres?.data?.[0]?.id;

  return {
    tempo: normalizeBpm(track.bpm),
    popularity: normalizeRank(track.rank),
    era: normalizeYear(releaseDate),
    explicitness: track.explicit_lyrics ? 1 : 0,
    genreAffinity: normalizeGenre(genreId),
  };
}

/**
 * Cosine similarity between two VibeVectors.
 * Returns 0-1 where >0.70 = strong musical match.
 */
export function cosineSimilarity(a: VibeVector, b: VibeVector): number {
  const vals = (v: VibeVector) => [v.tempo, v.popularity, v.era, v.explicitness, v.genreAffinity];
  const va = vals(a);
  const vb = vals(b);

  const dot = va.reduce((acc, val, i) => acc + val * vb[i], 0);
  const magA = Math.sqrt(va.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vb.reduce((acc, val) => acc + val * val, 0));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Hook to compute a VibeVector from a Deezer track ID.
 * Fetches full track details (needed for bpm, genres, release_date).
 */
export function useMusicFeatures(trackId: number | null) {
  const [vibeVector, setVibeVector] = useState<VibeVector | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const track = await deezerApi.getTrack(id);
      const vector = buildVibeVector(track);
      setVibeVector(vector);
      return vector;
    } catch (e) {
      setError('Error al analizar el track');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { vibeVector, isLoading, error, compute };
}
