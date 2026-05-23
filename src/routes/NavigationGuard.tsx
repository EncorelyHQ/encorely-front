import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { useSpotifyAuth } from '@/shared/context/SpotifyAuthContext';
import { useOnboarding } from '@/shared/context/OnboardingContext';

export function NavigationGuard() {
  const { userId, isAuthenticated, isLoading: encorelyLoading } = useEncorelyAuth();
  const { user: spotifyUser, accessToken, isLoading: spotifyLoading } = useSpotifyAuth();
  const { isComplete: onboardingComplete, isLoaded: onboardingLoaded } = useOnboarding();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (encorelyLoading || spotifyLoading || !onboardingLoaded || !rootNavigationState?.key) {
      return;
    }

    const group = segments[0];
    const route = segments.at(1);
    if (!group) return;

    const hasSpotifySession = !!(spotifyUser && accessToken);
    const isAppAuthenticated = isAuthenticated;

    if (group === 'spotify-callback' && !isAppAuthenticated) {
      // Do not interrupt the Spotify OAuth callback while it is exchanging tokens.
      return;
    }

    const inOnboarding = group === '(onboarding)';
    const inAuth = group === '(auth)' || group === 'spotify-callback';
    const inMain = group === '(main)';

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

      if (inMain) {
        router.replace('/(onboarding)/step-1');
        return;
      }
      if (inAuth) {
        const isLoginRoute = route === 'login';
        if (isLoginRoute) {
          return;
        }
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
      // If we're authenticated, we shouldn't be in the auth group or spotify-callback.
      router.replace('/(main)');
      return;
    }
  }, [
    encorelyLoading,
    spotifyLoading,
    onboardingLoaded,
    onboardingComplete,
    segments,
    rootNavigationState?.key,
    router,
    isAuthenticated,
    userId,
    spotifyUser,
    accessToken,
  ]);

  return null;
}
