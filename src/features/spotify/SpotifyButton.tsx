import { ActivityIndicator, Pressable, StyleSheet } from 'react-native'
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { haptics, Icon, motion, radius, space, SpotifyLogoIcon, Text, touch, useStyles, useTheme } from '@/ui'

// Única excepción a la paleta de Encorely: la guía de marca de Spotify exige su verde en sus botones.
// Va con texto y logo casi negros (`onTicket`, 9.3:1) y nunca blancos (2.6:1, no pasa AA). No usar fuera de aquí.
const SPOTIFY_GREEN = '#1ED760'

const ease = Easing.bezier(...motion.easeOut)

// `lg` para ponerlo junto a los botones grandes de la entrada; en la tarjeta del perfil va el de siempre.
type SpotifyButtonProps = { label: string; busyLabel: string; busy: boolean; onPress: () => void; size?: 'md' | 'lg' }

export function SpotifyButton({ label, busyLabel, busy, onPress, size = 'md' }: SpotifyButtonProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const animateTo = (value: number) => {
    scale.set(
      withTiming(value, {
        duration: motion.duration.fast,
        easing: ease,
        reduceMotion: ReduceMotion.System,
      }),
    )
  }

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? busyLabel : label}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        onPress={() => {
          haptics.selection()
          onPress()
        }}
        style={[styles.spotifyButton, size === 'lg' ? styles.lg : null]}
      >
        {busy ? (
          <ActivityIndicator color={theme.onTicket} />
        ) : (
          <Icon icon={SpotifyLogoIcon} size={24} color="onTicket" weight="fill" />
        )}
        <Text variant="headline" color="onTicket" numberOfLines={2} style={styles.spotifyLabel}>
          {busy ? busyLabel : label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const makeStyles = () =>
  StyleSheet.create({
    spotifyButton: {
      minHeight: touch.comfortable,
      borderRadius: radius.full,
      backgroundColor: SPOTIFY_GREEN,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      paddingHorizontal: space.xl,
      paddingVertical: space.md,
    },
    lg: { minHeight: touch.large, paddingVertical: space.lg },
    spotifyLabel: { flexShrink: 1, textAlign: 'center' },
  })
