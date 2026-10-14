import { Pressable, StyleSheet, View } from 'react-native'
import { CheckIcon, haptics, Icon, radius, space, Text, touch, useStyles, useTheme, type Theme } from '@/ui'

type ConsentCheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  error?: string | null
  disabled?: boolean
}

export function ConsentCheckbox({ checked, onChange, label, error, disabled }: ConsentCheckboxProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const boxBorder = error ? theme.danger : checked ? theme.accent : theme.borderInput

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: !!disabled }}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        disabled={disabled}
        onPress={() => {
          haptics.selection()
          onChange(!checked)
        }}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null]}
      >
        <View style={[styles.box, { borderColor: boxBorder, backgroundColor: checked ? theme.accent : theme.surface }]}>
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

const BOX = space.xl

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.md,
      minHeight: touch.comfortable,
      paddingVertical: space.sm,
      paddingHorizontal: space.sm,
      marginHorizontal: -space.sm,
      borderRadius: radius.sm,
    },
    pressed: { backgroundColor: t.surface2 },
    disabled: { opacity: 0.45 },
    box: {
      width: BOX,
      height: BOX,
      borderRadius: space.xs + 2,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { flex: 1 },
    error: { paddingLeft: BOX + space.md },
  })
