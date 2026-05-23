import { useCallback, useState } from 'react';
import { swipeService } from '@/modules/swipe/services/swipeService';
import { spotifySwipeService, type SwipeTrack } from '@/clients/spotify/swipeFeed';
import { mapNextTrackToSwipeTrack } from '@/modules/swipe/utils/mapTrack';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';

const BATCH_SIZE = 5;

export function useSwipeFeed() {
  const { userId } = useEncorelyAuth();
  const { getValidToken } = useSpotifyAuth();
  const [loading, setLoading] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const fetchBatch = useCallback(async (): Promise<SwipeTrack[]> => {
    if (!userId) return [];
    setLoading(true);
    const collected: SwipeTrack[] = [];

    try {
      for (let i = 0; i < BATCH_SIZE; i++) {
        const next = await swipeService.getNextTrack(userId);
        collected.push(mapNextTrackToSwipeTrack(next));
      }
    } catch (e) {
      console.warn('[useSwipeFeed] API feed failed, trying Spotify fallback:', e);
      const spotifyToken = await getValidToken();
      if (spotifyToken) {
        const fallback = await spotifySwipeService.getSwipeBatch(spotifyToken);
        collected.push(...fallback);
      }
    } finally {
      setLoading(false);
      setFetchAttempted(true);
    }

    return collected;
  }, [userId, getValidToken]);

  return { fetchBatch, loading, fetchAttempted, setFetchAttempted };
}
