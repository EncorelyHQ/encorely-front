import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated'
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile'
import { Button, Icon, motion, space, Text, useStyles, type Theme } from '@/ui'
import type { SessionRow } from '../sessions'

type SessionItemProps = {
  row: SessionRow
  onClose?: () => void
  closing?: boolean
  disabled?: boolean
}

// Al cerrar una sesión la fila se desvanece y las demás suben: sin esto la lista "salta" al refrescar.
const exiting = FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)
const layout = LinearTransition.duration(motion.duration.base)
  .easing(Easing.bezier(...motion.easeOut))
  .reduceMotion(ReduceMotion.System)

// Fila de dos niveles: quién (este teléfono / otro) y cuándo, en mono porque son fechas medibles.
export function SessionItem({ row, onClose, closing, disabled }: SessionItemProps) {
  const styles = useStyles(makeStyles)
  return (
    <Animated.View style={styles.row} exiting={exiting} layout={layout}>
      <View style={styles.main} accessible accessibilityLabel={row.accessibilityLabel}>
        <Icon icon={DeviceMobileIcon} size={24} color="textMuted" />
        <View style={styles.texts}>
          <Text variant="headline">{row.title}</Text>
          <View style={styles.meta}>
            <Text variant="footnote" color="textMuted">
              Inició{' '}
              <Text variant="data" color="text">
                {row.startedLabel}
              </Text>
            </Text>
            <Text variant="footnote" color="textMuted">
              Último uso{' '}
              <Text variant="data" color="text">
                {row.lastUsedLabel}
              </Text>
            </Text>
          </View>
        </View>
      </View>
      {onClose ? (
        <Button
          label="Cerrar"
          variant="secondary"
          fullWidth={false}
          loading={closing}
          disabled={disabled}
          onPress={onClose}
          accessibilityLabel={`Cerrar sesión en ${row.title.toLowerCase()}. Inició el ${row.startedLabel}`}
        />
      ) : null}
    </Animated.View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: t.surface,
    },
    main: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    texts: { flex: 1, gap: space.xs },
    meta: { gap: 2 },
  })
