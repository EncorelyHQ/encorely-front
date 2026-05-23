import { useCallback, useState } from 'react';
import { matchesService } from '@/modules/matches/services/matchesService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export function useAcceptMatch() {
  const { userId } = useEncorelyAuth();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    async (matchId: string): Promise<string | null> => {
      if (!userId) return null;
      setAccepting(true);
      setError(null);
      try {
        const res = await matchesService.accept(matchId, userId);
        return res.roomId;
      } catch (e) {
        setError(getApiErrorMessage(e));
        return null;
      } finally {
        setAccepting(false);
      }
    },
    [userId]
  );

  return { accept, accepting, error };
}
