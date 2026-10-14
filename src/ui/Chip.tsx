import { Pressable, StyleSheet } from 'react-native'
import { CheckIcon as Check } from './icons'
import { haptics } from './haptics'
import { Icon } from './Icon'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, touch, type Theme } from './tokens'

type ChipProps = {
  label: string
  selected?: boolean
  onPress?: () => void
  disabled?: boolean
}

// Chip seleccionable (géneros, filtros). Sin onPress se comporta como etiqueta estática.
export function Chip({ label, selected = false, onPress, disabled }: ChipProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)

  if (!onPress) {
    return (
      <Text variant="caption" color="textMuted" style={styles.tag}>
        {label}
      </Text>
    )
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        haptics.selection()
        onPress()
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : pressed ? theme.surface2 : theme.surface,
          borderColor: selected ? theme.accent : theme.borderInput,
          opacity: disabled && !selected ? 0.45 : 1,
        },
      ]}
    >
      {selected ? <Icon icon={Check} size={16} color="onAccent" weight="bold" /> : null}
      <Text variant="callout" color={selected ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      minHeight: touch.min,
      paddingHorizontal: space.lg,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs + 2,
    },
    tag: {
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
    },
  })
