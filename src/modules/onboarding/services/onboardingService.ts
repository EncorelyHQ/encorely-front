import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ONBOARDING_STORAGE_KEYS,
  type OnboardingPreferences,
} from '@/config/onboarding';

/** Persistencia local del onboarding hasta integrar API de preferencias. */
export const onboardingService = {
  isComplete: async () => {
    const v = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEYS.complete);
    return v === 'true';
  },

  setComplete: async (value: boolean) => {
    await AsyncStorage.setItem(
      ONBOARDING_STORAGE_KEYS.complete,
      value ? 'true' : 'false'
    );
  },

  getPreferences: async (): Promise<OnboardingPreferences | null> => {
    const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEYS.preferences);
    return raw ? (JSON.parse(raw) as OnboardingPreferences) : null;
  },

  savePreferences: async (prefs: OnboardingPreferences) => {
    await AsyncStorage.setItem(
      ONBOARDING_STORAGE_KEYS.preferences,
      JSON.stringify(prefs)
    );
  },
};
