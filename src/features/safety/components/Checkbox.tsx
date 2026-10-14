import { Pressable, StyleSheet, View } from 'react-native'
import { CheckIcon, haptics, Icon, radius, space, Text, touch, useStyles, type Theme } from '@/ui'

type CheckboxProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  const styles = useStyles(makeStyles)
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection()
        onChange(!checked)
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Icon icon={CheckIcon} size={16} color="onAccent" weight="bold" /> : null}
      </View>
      <Text variant="callout" style={styles.label}>
        {label}
      </Text>
    </Pressable>
  )
}

const BOX = space.xl - space.xs

const makeStyles = (t: Theme) =>
  StyleSheet.create({
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
    boxChecked: { backgroundColor: t.accent, borderColor: t.accent },
    label: { flex: 1 },
  })
