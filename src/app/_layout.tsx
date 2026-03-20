import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';

function NavigationGuard() {
  const { user: spotifyUser, isLoading: authLoading } = useSpotifyAuth();
  const { vibeVector } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (authLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const isLoggedIn = !!spotifyUser;

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      router.replace('/(main)');
    }
  }, [spotifyUser, authLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationGuard />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
