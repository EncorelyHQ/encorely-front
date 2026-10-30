import '@/lib/polyfills'
import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider as NavThemeProvider } from 'expo-router'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display'
import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo'
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono'
import { userMessage } from '@/lib/api/errors'
import { isApiConfigured } from '@/lib/config'
import { OfflineBanner, setupQueryEnvironment } from '@/lib/net'
import { queryClient } from '@/lib/query'
import { SessionProvider, useSession } from '@/lib/session/SessionContext'
import { ErrorState, Screen, ThemeProvider, ToastProvider, useTheme } from '@/ui'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => setupQueryEnvironment(), [])
  const [fontsLoaded, fontError] = useFonts({
    BigShouldersDisplay_700Bold,
    BigShouldersDisplay_800ExtraBold,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexMono_500Medium,
  })

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <SessionProvider>
                <ToastProvider>
                  <RootNavigator ready={fontsLoaded || !!fontError} />
                </ToastProvider>
              </SessionProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator({ ready }: { ready: boolean }) {
  const theme = useTheme()
  const { status, user, bootError, retryBoot } = useSession()
  const resolved = ready && status !== 'loading'

  // El splash se queda hasta saber si hay sesión: así no destella el onboarding ni el login.
  useEffect(() => {
    if (resolved) void SplashScreen.hideAsync()
  }, [resolved])

  const base = theme.scheme === 'venue' ? DarkTheme : DefaultTheme
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.bg,
      card: theme.bg,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
      notification: theme.accent,
    },
  }

  if (!resolved) return null

  if (!isApiConfigured) {
    return (
      <Screen>
        <ErrorState
          title="Falta configurar el servidor"
          message="Define EXPO_PUBLIC_API_URL en .env (en el emulador Android: http://10.0.2.2:5000) y vuelve a iniciar la app."
        />
      </Screen>
    )
  }

  if (status === 'bootError') {
    return (
      <Screen>
        <ErrorState title="No pudimos abrir tu sesión" message={userMessage(bootError)} onRetry={retryBoot} />
      </Screen>
    )
  }

  const signedIn = status === 'signedIn' && !!user
  const onboarded = !!user?.onboardingCompleted

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={theme.scheme === 'venue' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="spotify-callback" />
      </Stack>
      <OfflineBanner />
    </NavThemeProvider>
  )
}
