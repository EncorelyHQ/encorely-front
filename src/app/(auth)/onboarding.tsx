import { Redirect } from 'expo-router';

/** @deprecated Use the `(onboarding)` flow (`step-1` … `step-6`). */
export default function LegacyOnboardingRedirect() {
  return <Redirect href="/(onboarding)/step-1" />;
}

