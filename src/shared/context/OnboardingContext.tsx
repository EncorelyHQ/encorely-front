import React, { createContext, useContext } from 'react';
import { useOnboardingState } from '@/shared/hooks/useOnboardingState';

type OnboardingContextValue = ReturnType<typeof useOnboardingState>;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const value = useOnboardingState();
  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
