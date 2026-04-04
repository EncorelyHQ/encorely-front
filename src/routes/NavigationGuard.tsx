import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '@/shared/context/AuthContext';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { useOnboarding } from '@/shared/context/OnboardingContext';

export function NavigationGuard() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { user: spotifyUser, accessToken, isLoading: spotifyLoading } = useSpotifyAuth();
  const { isComplete: onboardingComplete, isLoaded: onboardingLoaded } = useOnboarding();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (authLoading || spotifyLoading || !onboardingLoaded || !rootNavigationState?.key) {
      return;
    }

    const group = segments[0];
    const route = segments.at(1);
    if (!group) return;

    const hasSpotifySession = !!(spotifyUser && accessToken);
    const inOnboarding = group === '(onboarding)';
    const inAuth = group === '(auth)';
    const inMain = group === '(main)';
    const isAppAuthenticated = !!authUser || hasSpotifySession;

    const earlyOnboardingRoute =
      route === 'step-1' ||
      route === 'step-2' ||
      route === 'step-3' ||
      route === 'step-4';
    const lateOnboardingRoute = route === 'step-5' || route === 'step-6';

    if (!onboardingComplete) {
      if (hasSpotifySession) {
        if (inMain || inAuth) {
          router.replace('/(onboarding)/step-5');
          return;
        }
        if (inOnboarding && earlyOnboardingRoute) {
          router.replace('/(onboarding)/step-5');
          return;
        }
        return;
      }

      if (inMain || inAuth) {
        router.replace('/(onboarding)/step-1');
        return;
      }
      if (inOnboarding && lateOnboardingRoute) {
        router.replace('/(onboarding)/step-4');
        return;
      }
      return;
    }

    if (inOnboarding) {
      router.replace('/(main)');
      return;
    }

    if (!isAppAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAppAuthenticated && inAuth) {
      router.replace('/(main)');
      return;
    }
  }, [
    authLoading,
    spotifyLoading,
    onboardingLoaded,
    onboardingComplete,
    segments,
    rootNavigationState?.key,
    router,
    authUser,
    spotifyUser,
    accessToken,
  ]);

  return null;
}
