import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ONBOARDING_STORAGE_KEYS,
  type OnboardingPreferences,
} from '@/config/onboarding';

const defaultPreferences = (): OnboardingPreferences => ({
  artists: [],
  genres: [],
});

export function useOnboardingState() {
  const [isComplete, setIsComplete] = useState(false);
  const [preferences, setPreferences] = useState<OnboardingPreferences>(defaultPreferences);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [completeRaw, prefsRaw] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_STORAGE_KEYS.complete),
          AsyncStorage.getItem(ONBOARDING_STORAGE_KEYS.preferences),
        ]);
        setIsComplete(completeRaw === 'true');
        if (prefsRaw) {
          const parsed = JSON.parse(prefsRaw) as Partial<
            OnboardingPreferences & { artistIds?: string[] }
          >;
          let artists = Array.isArray(parsed.artists) ? parsed.artists : [];
          if (
            artists.length === 0 &&
            Array.isArray(parsed.artistIds) &&
            parsed.artistIds.length > 0
          ) {
            artists = parsed.artistIds.map((id) => ({ id, name: 'Artista' }));
          }
          setPreferences({
            artists: artists.filter((a) => a?.id && a?.name),
            genres: Array.isArray(parsed.genres) ? parsed.genres : [],
          });
        }
      } catch {
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setOnboardingComplete = useCallback(async (value: boolean) => {
    setIsComplete(value);
    try {
      if (value) {
        await AsyncStorage.setItem(ONBOARDING_STORAGE_KEYS.complete, 'true');
      } else {
        await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEYS.complete);
      }
    } catch {
    }
  }, []);

  const savePreferences = useCallback(async (next: OnboardingPreferences) => {
    setPreferences(next);
    try {
      await AsyncStorage.setItem(
        ONBOARDING_STORAGE_KEYS.preferences,
        JSON.stringify(next)
      );
    } catch {
    }
  }, []);

  return {
    isComplete,
    preferences,
    isLoaded,
    setOnboardingComplete,
    savePreferences,
  };
}
