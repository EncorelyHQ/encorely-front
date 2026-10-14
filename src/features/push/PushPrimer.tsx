import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, Keyframe, ReduceMotion, useReducedMotion } from 'react-native-reanimated'
import { BellSimpleIcon } from './icons'
// Direct imports instead of the '@/ui' barrel: the barrel drags Screen/keyboard-controller into every test.
import { Button } from '@/ui/Button'
import { Icon } from '@/ui/Icon'
import { Text } from '@/ui/Text'
import { useToast } from '@/ui/Toast'
import { useStyles } from '@/ui/theme'
import { motion, radius, space, type Theme } from '@/ui/tokens'
import { usePushPrompt } from './usePushPrompt'

const easeOut = Easing.bezier(...motion.easeOut)

// A short rise (one spacing step) reads as "this just arrived" without pulling focus from the screen.
const enterRise = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: space.sm }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: easeOut },
})
  .duration(motion.duration.base)
  .reduceMotion(ReduceMotion.Never)
const enterFade = FadeIn.duration(motion.duration.fast).reduceMotion(ReduceMotion.Never)
// Exit is faster than enter: once the user decided, the card should get out of the way.
const exitFade = FadeOut.duration(motion.duration.fast).easing(easeOut).reduceMotion(ReduceMotion.Never)

// Self-contained: renders nothing unless the OS prompt can still be shown and "Ahora no" is not active.
export function PushPrimer() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const reduceMotion = useReducedMotion()
  const { visible, requesting, accept, dismiss } = usePushPrompt()

  if (!visible) return null

  const onAccept = async () => {
    const permission = await accept()
    // No success haptic here: that one is reserved for the match moment.
    if (permission === 'granted') {
      toast.show('Listo. Te avisamos cuando alguien te escriba.', 'success')
    } else if (permission === 'denied' || permission === 'blocked') {
      toast.show('Los avisos quedaron apagados. Puedes activarlos en los ajustes del teléfono.')
    }
  }

  return (
    <Animated.View entering={reduceMotion ? enterFade : enterRise} exiting={exitFade} style={styles.card}>
      <View style={styles.body}>
        <Icon icon={BellSimpleIcon} size={24} color="accentText" />
        <View style={styles.copy}>
          <Text variant="headline" accessibilityRole="header">
            Te avisamos cuando alguien te escriba.
          </Text>
          <Text variant="footnote" color="textMuted">
            Nunca mostramos el contenido del mensaje en la notificación.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Ahora no" variant="ghost" fullWidth onPress={() => void dismiss()} disabled={requesting} />
        </View>
        <View style={styles.action}>
          <Button label="Activar avisos" variant="secondary" fullWidth loading={requesting} onPress={() => void onAccept()} />
        </View>
      </View>
    </Animated.View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.lg,
    },
    body: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    copy: { flex: 1, gap: space.xs },
    // Side by side when they fit; with a large font scale each button takes its own row.
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    action: { flexGrow: 1 },
  })
