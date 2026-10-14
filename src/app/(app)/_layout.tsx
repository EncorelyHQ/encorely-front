import { Stack } from 'expo-router'
import { ChatBootstrap } from '@/features/chat'
import { PushBootstrap } from '@/features/push'
import { font, useTheme } from '@/ui'

export const unstable_settings = { initialRouteName: '(tabs)' }

// Las pantallas de detalle se apilan sobre las tabs: swipe-back en iOS, sin tab bar y con historial al abrir desde un push.
export default function AppLayout() {
  const theme = useTheme()
  return (
    <>
      <ChatBootstrap />
      <PushBootstrap />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.bg },
          headerTitleStyle: { fontFamily: font.bodySemibold, fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="match/[matchId]"
          options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }}
        />
      </Stack>
    </>
  )
}
