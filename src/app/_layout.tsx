import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/shared/context/AuthContext';
import { SpotifyAuthProvider } from '@/shared/context/SpotifyAuthContext';
import { OnboardingProvider } from '@/shared/context/OnboardingContext';
import { CustomThemeProvider } from '@/shared/theme/ThemeProvider';
import { NavigationGuard } from '@/routes/NavigationGuard';
import { useFonts } from 'expo-font';
import {
  GolosText_400Regular,
  GolosText_600SemiBold,
  GolosText_700Bold,
  GolosText_900Black,
} from '@expo-google-fonts/golos-text';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

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
            <SpotifyAuthProvider>
              <OnboardingProvider>
                <NavigationGuard />
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#181818' } }} />
              </OnboardingProvider>
            </SpotifyAuthProvider>
          </AuthProvider>
        </CustomThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
