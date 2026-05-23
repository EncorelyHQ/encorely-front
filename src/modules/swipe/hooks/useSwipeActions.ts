import { useCallback } from 'react';
import { SwipeDirection } from '@/clients/encorely/types';
import { swipeService } from '@/modules/swipe/services/swipeService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';

export function useSwipeActions() {
  const { userId, refreshProfile } = useEncorelyAuth();

  const recordSwipe = useCallback(
    async (trackId: string, direction: SwipeDirection) => {
      if (!userId) return;
      await swipeService.recordSwipe({
        userId,
        trackId,
        direction,
      });
      await refreshProfile();
    },
    [userId, refreshProfile]
  );

  const like = useCallback(
    (trackId: string) => recordSwipe(trackId, SwipeDirection.Right),
    [recordSwipe]
  );

  const dislike = useCallback(
    (trackId: string) => recordSwipe(trackId, SwipeDirection.Left),
    [recordSwipe]
  );

  return { like, dislike, recordSwipe };
}
