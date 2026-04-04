import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '@/shared/context/AuthContext';

export function NavigationGuard() {
  const { user: authUser, isLoading: authContextLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (authContextLoading || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isLoggedIn = !!authUser;

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(main)');
    }
  }, [authUser, authContextLoading, segments, rootNavigationState?.key, router]);

  return null;
}
