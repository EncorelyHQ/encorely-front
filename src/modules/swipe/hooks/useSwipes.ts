import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SWIPES_KEY = '@encorely_swipes_count';
export const SWIPE_THRESHOLD = 100;

export function useSwipes() {
  const [swipeCount, setSwipeCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SWIPES_KEY);
        if (stored !== null) {
          setSwipeCount(parseInt(stored, 10));
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const incrementSwipe = useCallback(async () => {
    try {
      setSwipeCount((prev) => {
        const newCount = prev + 1;
        AsyncStorage.setItem(SWIPES_KEY, String(newCount)).catch(() => undefined);
        return newCount;
      });
    } catch {
    }
  }, []);

  const resetSwipes = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SWIPES_KEY);
      setSwipeCount(0);
    } catch {
    }
  }, []);

  const isRadarUnlocked = swipeCount >= SWIPE_THRESHOLD;

  return {
    swipeCount,
    isRadarUnlocked,
    isLoading,
    incrementSwipe,
    resetSwipes,
  };
}
