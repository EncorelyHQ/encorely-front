import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VibeVector } from '@/shared/types/vibe';
import {
  ONBOARDING_SWIPES_REQUIRED,
  RADAR_SWIPES_THRESHOLD,
} from '@/config/onboarding';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';

const STORAGE_KEY = '@encorely_swipe_likes';

export interface SwipeData {
  likes: string[];
  dislikes: string[];
}

export function useSwipeEngine() {
  const { profile, isLoading: profileLoading } = useEncorelyAuth();
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const swipeCount = profile?.swipeCount ?? 0;

  useEffect(() => {
    const loadData = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (jsonValue != null) {
          const data: SwipeData = JSON.parse(jsonValue);
          setLikes(data.likes || []);
          setDislikes(data.dislikes || []);
        }
      } catch (e) {
        console.error('[useSwipeEngine] Error loading likes:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const saveLikes = async (data: SwipeData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[useSwipeEngine] Error saving likes:', e);
    }
  };

  const like = async (trackId: string) => {
    const newLikes = [...likes, trackId];
    setLikes(newLikes);
    await saveLikes({ likes: newLikes, dislikes });
  };

  const dislike = async (trackId: string) => {
    const newDislikes = [...dislikes, trackId];
    setDislikes(newDislikes);
    await saveLikes({ likes, dislikes: newDislikes });
  };

  const resetSwipes = async () => {
    setLikes([]);
    setDislikes([]);
    await saveLikes({ likes: [], dislikes: [] });
  };

  const hasCompletedOnboardingSwipes = swipeCount >= ONBOARDING_SWIPES_REQUIRED;
  const hasReachedRadarThreshold = swipeCount >= RADAR_SWIPES_THRESHOLD;

  const isLoadedCombined = isLoaded && !profileLoading;

  return useMemo(
    () => ({
      swipesCount: swipeCount,
      likes,
      dislikes,
      isLoaded: isLoadedCombined,
      like,
      dislike,
      resetSwipes,
      hasCompletedOnboardingSwipes,
      hasReachedRadarThreshold,
    }),
    [
      swipeCount,
      likes,
      dislikes,
      isLoadedCombined,
      hasCompletedOnboardingSwipes,
      hasReachedRadarThreshold,
    ]
  );
}

export function computeUserVibe(likes: string[]): VibeVector {
  return {
    energy: 0.8,
    danceability: 0.7,
    valence: 0.6,
    tempo: 0.75,
  };
}
