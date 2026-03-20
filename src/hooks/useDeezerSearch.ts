import { useState, useEffect, useRef } from 'react';
import { deezerApi, DeezerTrack } from '../services/deezer';

export function useDeezerSearch(query: string) {
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setTracks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await deezerApi.searchTracks(trimmed, 8);
        setTracks(result.data);
        setError(null);
      } catch (e) {
        setError('No se pudo conectar a Deezer');
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return { tracks, isLoading, error };
}
