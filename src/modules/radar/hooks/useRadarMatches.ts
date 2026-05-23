import { useCallback, useState } from 'react';
import type { RadarMatch } from '@/clients/encorely/types';
import { radarService } from '@/modules/radar/services/radarService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { ApiError } from '@/clients/http/errors';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export function useRadarMatches() {
  const { userId } = useEncorelyAuth();
  const [matches, setMatches] = useState<RadarMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thresholdBlocked, setThresholdBlocked] = useState(false);

  const loadMatches = useCallback(
    async (eventId: string) => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      setThresholdBlocked(false);
      try {
        const list = await radarService.getEventMatches(eventId, userId);
        setMatches(list);
      } catch (e) {
        const msg = getApiErrorMessage(e);
        setError(msg);
        if (e instanceof ApiError && e.statusCode === 403) {
          setThresholdBlocked(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  return {
    matches,
    loading,
    error,
    thresholdBlocked,
    loadMatches,
    clearMatches: () => setMatches([]),
  };
}
