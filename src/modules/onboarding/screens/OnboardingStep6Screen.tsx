import React from 'react';
import { useRouter } from 'expo-router';
import SwipeScreen from '@/modules/swipe/screens/SwipeScreen';
import { useOnboarding } from '@/shared/context/OnboardingContext';

export default function OnboardingStep6Screen() {
  const router = useRouter();
  const { setOnboardingComplete } = useOnboarding();

  return (
    <SwipeScreen
      mode="onboarding"
      onOnboardingSwipesComplete={async () => {
        await setOnboardingComplete(true);
        router.replace('/(main)');
      }}
    />
  );
}
