import { useState, useCallback } from 'react';
import { computeVibeVector, cosineSimilarity, VibeVector } from '../services/spotifyService';

export type { VibeVector };
export { cosineSimilarity };

export interface UseVibeVectorResult {
  vibeVector: VibeVector | null;
  usedFallback: boolean;
  isLoading: boolean;
  error: string | null;
  compute: (accessToken: string) => Promise<VibeVector | null>;
}

export function useVibeVector(): UseVibeVectorResult {
  const [vibeVector, setVibeVector] = useState<VibeVector | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async (accessToken: string): Promise<VibeVector | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { vector, usedFallback: fell } = await computeVibeVector(accessToken);
      setVibeVector(vector);
      setUsedFallback(fell);

      // Required log
      console.log('[Encorely] VibeVector:', JSON.stringify(vector, null, 2));
      if (fell) {
        console.warn('[Encorely] Fallback usado — audio-features no disponibles');
      }

      return vector;
    } catch (e: any) {
      const msg = e?.message ?? 'Error calculando Vector de Vibe';
      setError(msg);
      console.error('[Encorely] useVibeVector error:', e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { vibeVector, usedFallback, isLoading, error, compute };
}
