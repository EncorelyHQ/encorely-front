import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from './Icon'
import { CheckIcon } from './icons'
import { haptics } from './haptics'
import { Text } from './Text'
import { useStyles } from './theme'
import { radius, space, touch, type Theme } from './tokens'

type CheckboxProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  error?: string | null
}

export function Checkbox({ label, checked, onChange, disabled, error }: CheckboxProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked, disabled: !!disabled }}
        accessibilityHint={error ?? undefined}
        disabled={disabled}
        onPress={() => {
          haptics.selection()
          onChange(!checked)
        }}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
      >
        <View style={[styles.box, error && !checked ? styles.boxError : null, checked ? styles.boxChecked : null]}>
          {checked ? <Icon icon={CheckIcon} size={16} color="onAccent" weight="bold" /> : null}
        </View>
        <Text variant="callout" style={styles.label}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const BOX = space.xl - space.xs

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.xs },
    row: {
      minHeight: touch.comfortable,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
    },
    pressed: { backgroundColor: t.surface2 },
    disabled: { opacity: 0.45 },
    box: {
      width: BOX,
      height: BOX,
      borderRadius: space.xs,
      borderWidth: 2,
      borderColor: t.borderInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxError: { borderColor: t.danger },
    boxChecked: { backgroundColor: t.accent, borderColor: t.accent },
    label: { flex: 1 },
    error: { paddingLeft: BOX + space.md * 2 },
  })
