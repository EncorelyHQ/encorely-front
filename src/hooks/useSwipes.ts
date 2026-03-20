import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SWIPES_KEY = '@encorely_swipes_count';
export const SWIPE_THRESHOLD = 100;

export function useSwipes() {
  const [swipeCount, setSwipeCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar contador desde persistencia al montar
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SWIPES_KEY);
        if (stored !== null) {
          setSwipeCount(parseInt(stored, 10));
        }
      } catch (e) {
        console.error('[useSwipes] Error loading count:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Incrementar el contador (persistentemente)
  const incrementSwipe = useCallback(async () => {
    try {
      setSwipeCount((prev) => {
        const newCount = prev + 1;
        AsyncStorage.setItem(SWIPES_KEY, String(newCount)).catch((e) =>
          console.error('[useSwipes] Error saving count:', e)
        );
        return newCount;
      });
    } catch (e) {
      console.error('[useSwipes] Exception in increment:', e);
    }
  }, []);

  // Utilidad de dev: resetear
  const resetSwipes = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SWIPES_KEY);
      setSwipeCount(0);
    } catch (e) {
      console.error('[useSwipes] Error resetting:', e);
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
