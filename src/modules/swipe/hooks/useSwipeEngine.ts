import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ONBOARDING_SWIPES_REQUIRED,
  RADAR_SWIPES_THRESHOLD,
} from '@/config/onboarding';
import { useAuth } from '@/shared/context/AuthContext';
import { registerSwipe, SwipeDirection } from '@/clients/api';

const STORAGE_KEY = '@encorely_swipe_state';

export interface SwipeData {
  swipesCount: number;
  likes: string[];
  dislikes: string[];
}

export function useSwipeEngine() {
  const { backendUserId } = useAuth();
  const [swipesCount, setSwipesCount] = useState(0);
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  /** Registra el swipe en el backend (best-effort: no bloquea ni rompe la UI). */
  const syncSwipe = (trackId: string, direction: SwipeDirection) => {
    if (!backendUserId) return;
    registerSwipe(backendUserId, trackId, direction).catch(() => undefined);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (jsonValue != null) {
          const data: SwipeData = JSON.parse(jsonValue);
          setSwipesCount(data.swipesCount || 0);
          setLikes(data.likes || []);
          setDislikes(data.dislikes || []);
        }
      } catch {
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const saveState = async (data: SwipeData) => {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch {
    }
  };

  const like = async (trackId: string) => {
    const newLikes = [...likes, trackId];
    const newCount = swipesCount + 1;
    setLikes(newLikes);
    setSwipesCount(newCount);
    syncSwipe(trackId, SwipeDirection.Like);
    await saveState({ swipesCount: newCount, likes: newLikes, dislikes });
  };

  const dislike = async (trackId: string) => {
    const newDislikes = [...dislikes, trackId];
    const newCount = swipesCount + 1;
    setDislikes(newDislikes);
    setSwipesCount(newCount);
    syncSwipe(trackId, SwipeDirection.Dislike);
    await saveState({ swipesCount: newCount, likes, dislikes: newDislikes });
  };

  const resetSwipes = async () => {
    setSwipesCount(0);
    setLikes([]);
    setDislikes([]);
    await saveState({ swipesCount: 0, likes: [], dislikes: [] });
  };

  const hasCompletedOnboardingSwipes = swipesCount >= ONBOARDING_SWIPES_REQUIRED;
  const hasReachedRadarThreshold = swipesCount >= RADAR_SWIPES_THRESHOLD;

  return {
    swipesCount,
    likes,
    dislikes,
    isLoaded,
    like,
    dislike,
    resetSwipes,
    hasCompletedOnboardingSwipes,
    hasReachedRadarThreshold,
  };
}

