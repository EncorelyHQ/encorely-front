import { Redirect, Stack } from 'expo-router'
import { MotionLabScreen } from '@/features/dev/MotionLabScreen'

// Solo en desarrollo y sin sesión: encorely://dev-motion
export default function DevMotionRoute() {
  if (!__DEV__) return <Redirect href="/" />
  return (
    <>
      <Stack.Screen options={{ title: 'Motion', headerShown: true }} />
      <MotionLabScreen />
    </>
  )
}
