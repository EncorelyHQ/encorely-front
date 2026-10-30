import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated'
import { Icon } from './Icon'
import { InfoIcon, WarningCircleIcon } from './icons'
import { Text } from './Text'
import { useStyles } from './theme'
import { motion, radius, space, type Theme } from './tokens'

type AlertProps = {
  message: string
  tone?: 'danger' | 'info'
}

const entering = FadeIn.duration(motion.duration.fast)
  .easing(Easing.bezier(...motion.easeOut))
  .reduceMotion(ReduceMotion.System)

// Error general del formulario: se queda visible junto al botón (un toast se iría antes de leerlo).
export function Alert({ message, tone = 'danger' }: AlertProps) {
  const styles = useStyles(makeStyles)
  return (
    <Animated.View entering={entering}>
      <View
        style={[styles.box, tone === 'danger' ? styles.danger : styles.info]}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={message}
      >
        <Icon icon={tone === 'danger' ? WarningCircleIcon : InfoIcon} size={20} color={tone === 'danger' ? 'danger' : 'textMuted'} />
        <Text variant="callout" style={styles.text}>
          {message}
        </Text>
      </View>
    </Animated.View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.sm,
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
      backgroundColor: t.surface,
      borderLeftWidth: space.xs,
    },
    danger: { borderLeftColor: t.danger },
    info: { borderLeftColor: t.textMuted },
    text: { flex: 1 },
  })
