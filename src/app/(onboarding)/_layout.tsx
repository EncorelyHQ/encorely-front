import { Stack } from 'expo-router'
import { useTheme } from '@/ui'

export const unstable_settings = { initialRouteName: 'about-you' }

export default function OnboardingLayout() {
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
      <Stack.Screen name="about-you" options={{ headerBackVisible: false }} />
      <Stack.Screen name="genres" />
    </Stack>
  )
}
