import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { router } from 'expo-router'
import { useSession } from '@/lib/session/SessionContext'
import { Alert, Button, motion, Screen, space, Text, type, useStyles, type Theme } from '@/ui'


// El logotipo es el "headliner" del cartel: 2.4× el display para que ENCORELY ocupe el ancho como en un afiche.
const LOGO_SCALE = 2.4

export function WelcomeScreen() {
  const styles = useStyles(makeStyles)
  const { notice } = useSession()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: motion.duration.base,
      easing: Easing.bezier(...motion.easeOut),
      reduceMotion: ReduceMotion.System,
    })
  }, [progress])

  // La manilla se "pega" de izquierda a derecha; el texto acompaña con un desplazamiento corto.
  const bandStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))
  const copyStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * space.sm }],
  }))

  return (
    <Screen mode="scroll" edges={['top', 'bottom']} padded={false}>
      <View style={styles.poster}>
        <Text
          variant="display"
          style={styles.logo}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          accessibilityLabel="Encorely"
        >
          ENCORELY
        </Text>
        <Animated.View style={[styles.band, bandStyle]} accessible={false} />
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
        <Text variant="footnote" color="textSubtle" align="center">
          Solo para mayores de 18 años.
        </Text>
      </View>
    </Screen>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    poster: { flex: 1, justifyContent: 'center', paddingTop: space.xxl },
    logo: {
      fontSize: type.display.fontSize * LOGO_SCALE,
      lineHeight: type.display.fontSize * LOGO_SCALE,
      paddingHorizontal: space.gutter,
    },
    // Sangra hacia el borde derecho como una manilla puesta sobre el cartel.
    band: {
      height: space.md,
      marginLeft: space.gutter,
      marginTop: space.md,
      backgroundColor: t.accent,
      borderTopLeftRadius: space.xs / 2,
      borderBottomLeftRadius: space.xs / 2,
      transformOrigin: 'left',
    },
    copy: { gap: space.md, paddingHorizontal: space.gutter, marginTop: space.xl },
    actions: { gap: space.md, paddingHorizontal: space.gutter, paddingBottom: space.lg },
  })
