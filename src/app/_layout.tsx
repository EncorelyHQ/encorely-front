import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';

import { CustomThemeProvider } from '../theme/ThemeProvider';
import { useFonts } from 'expo-font';
import { GolosText_400Regular, GolosText_600SemiBold, GolosText_700Bold, GolosText_900Black } from '@expo-google-fonts/golos-text';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function NavigationGuard() {
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
  }, [authUser, authContextLoading, segments, rootNavigationState?.key]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    GolosText_400Regular,
    GolosText_600SemiBold,
    GolosText_700Bold,
    GolosText_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CustomThemeProvider>
          <AuthProvider>
            <NavigationGuard />
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#181818' } }} />
          </AuthProvider>
        </CustomThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
