import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { router } from 'expo-router'
import { useSession } from '@/lib/session/SessionContext'
import { Alert, Button, Logo, motion, Screen, space, Text, useStyles } from '@/ui'
import { OrDivider } from '../components/OrDivider'
import { SpotifySignIn } from '../components/SpotifySignIn'

export function WelcomeScreen() {
  const styles = useStyles(makeStyles)
  const { notice } = useSession()
  const { width } = useWindowDimensions()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: motion.duration.base,
      easing: Easing.bezier(...motion.easeOut),
      reduceMotion: ReduceMotion.System,
    })
  }, [progress])

  const copyStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * space.sm }],
  }))

  return (
    <Screen mode="scroll" edges={['top', 'bottom']} padded={false}>
      <View style={styles.poster}>
        {/* El logo es el "headliner" del cartel: ocupa el ancho como en un afiche. */}
        <View style={styles.logo}>
          <Logo width={width - space.gutter * 2} />
        </View>
        <Animated.View style={[styles.copy, copyStyle]}>
          <Text variant="title1">Encuentra con quién ir al próximo concierto.</Text>
          <Text variant="body" color="textMuted">
            Califica canciones, elige un concierto y mira quién más va y escucha lo mismo que tú.
          </Text>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        {notice ? <Alert tone="info" message={notice} /> : null}
        <Button label="Crear cuenta" size="lg" onPress={() => router.push('/register')} />
        <Button label="Ya tengo cuenta" variant="secondary" size="lg" onPress={() => router.push('/login')} />
        <OrDivider />
        <SpotifySignIn />
        <Text variant="footnote" color="textSubtle" align="center">
          Solo para mayores de 18 años.
        </Text>
      </View>
    </Screen>
  )
}

const makeStyles = () =>
  StyleSheet.create({
    poster: { flex: 1, justifyContent: 'center', paddingTop: space.xxl },
    logo: { paddingHorizontal: space.gutter },
    copy: { gap: space.md, paddingHorizontal: space.gutter, marginTop: space.xl },
    actions: { gap: space.md, paddingHorizontal: space.gutter, paddingBottom: space.lg },
  })
