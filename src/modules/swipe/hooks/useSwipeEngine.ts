import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VibeVector } from '@/shared/types/vibe';
import {
  ONBOARDING_SWIPES_REQUIRED,
  RADAR_SWIPES_THRESHOLD,
} from '@/config/onboarding';

const STORAGE_KEY = '@encorely_swipe_state';

export interface SwipeData {
  swipesCount: number;
  likes: string[];
  dislikes: string[];
}

export function useSwipeEngine() {
  const [swipesCount, setSwipesCount] = useState(0);
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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
      } catch (e) {
        console.error('[useSwipeEngine] Error loading state from AsyncStorage:', e);
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
    } catch (e) {
      console.error('[useSwipeEngine] Error saving state to AsyncStorage:', e);
    }
  };

  const like = async (trackId: string) => {
    const newLikes = [...likes, trackId];
    const newCount = swipesCount + 1;
    setLikes(newLikes);
    setSwipesCount(newCount);
    await saveState({ swipesCount: newCount, likes: newLikes, dislikes });
  };

  const dislike = async (trackId: string) => {
    const newDislikes = [...dislikes, trackId];
    const newCount = swipesCount + 1;
    setDislikes(newDislikes);
    setSwipesCount(newCount);
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

export function computeUserVibe(likes: string[]): VibeVector {
  console.log(`[useSwipeEngine] Computando vibe en base a ${likes.length} likes...`);
  return {
    energy: 0.8,
    danceability: 0.7,
    valence: 0.6,
    tempo: 0.75,
  };
}
