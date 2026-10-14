import { Stack } from 'expo-router'
import { useTheme } from '@/ui'

export const unstable_settings = { initialRouteName: 'welcome' }

export default function AuthLayout() {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitle: '',
        headerTintColor: theme.text,
        headerStyle: { backgroundColor: theme.bg },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  )
}
