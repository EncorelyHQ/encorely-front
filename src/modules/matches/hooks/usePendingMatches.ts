import { useCallback, useEffect, useState } from 'react';
import { matchesService } from '@/modules/matches/services/matchesService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { mapPendingMatchToCard, type MatchCardView } from '@/modules/matches/types/match.types';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export function usePendingMatches() {
  const { userId } = useEncorelyAuth();
  const [matches, setMatches] = useState<MatchCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const pending = await matchesService.getPending(userId);
      setMatches(pending.map(mapPendingMatchToCard));
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { matches, loading, error, reload: load };
}
