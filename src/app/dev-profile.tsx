import { Redirect, Stack } from 'expo-router'
import { ProfileLabScreen } from '@/features/dev/ProfileLabScreen'

// Solo en desarrollo y sin sesión: encorely://dev-profile
export default function DevProfileRoute() {
  if (!__DEV__) return <Redirect href="/" />
  return (
    <>
      <Stack.Screen options={{ title: 'Perfil', headerShown: true }} />
      <ProfileLabScreen />
    </>
  )
}
