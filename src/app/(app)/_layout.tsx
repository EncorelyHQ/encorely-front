import { Stack } from 'expo-router'
import { font, useTheme } from '@/ui'

export const unstable_settings = { initialRouteName: '(tabs)' }

// Las pantallas de detalle se apilan sobre las tabs: swipe-back en iOS, sin tab bar y con historial al abrir desde un push.
export default function AppLayout() {
  const theme = useTheme()
  return (
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
    </Stack>
  )
}
