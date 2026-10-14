import { Pressable, StyleSheet, View } from 'react-native'
import { haptics, radius, space, Text, touch, useStyles, type Theme } from '@/ui'

export type RadioOption<T extends string> = { value: T; label: string }

type RadioGroupProps<T extends string> = {
  label: string
  options: readonly RadioOption<T>[]
  value: T | null
  onChange: (value: T) => void
  // 'row' para dos o tres opciones cortas (ciudad); 'column' para listas (motivos de reporte).
  direction?: 'row' | 'column'
  disabled?: boolean
}

// Selección única accesible: TalkBack/VoiceOver anuncian "botón de opción, 2 de 6, seleccionado".
// Candidato a moverse a @/ui cuando otro módulo lo necesite.
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  direction = 'column',
  disabled,
}: RadioGroupProps<T>) {
  const styles = useStyles(makeStyles)
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={direction === 'row' ? styles.row : styles.column}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => {
              if (selected) return
              haptics.selection()
              onChange(option.value)
            }}
            style={({ pressed }) => [
              styles.option,
              direction === 'row' ? styles.optionRow : null,
              selected ? styles.optionSelected : null,
              pressed && !selected ? styles.optionPressed : null,
              disabled ? styles.disabled : null,
            ]}
          >
            <View style={[styles.ring, selected ? styles.ringSelected : null]}>
              {selected ? <View style={styles.dot} /> : null}
            </View>
            <Text variant="body" style={styles.label}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const RING = space.xl - space.xs
const DOT = space.md - space.xs / 2

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    column: { gap: space.xs },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    option: {
      minHeight: touch.comfortable,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    optionRow: { borderColor: t.borderInput, backgroundColor: t.surface, paddingHorizontal: space.lg },
    optionSelected: { borderColor: t.accent },
    optionPressed: { backgroundColor: t.surface2 },
    disabled: { opacity: 0.45 },
    ring: {
      width: RING,
      height: RING,
      borderRadius: radius.full,
      borderWidth: 2,
      borderColor: t.borderInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringSelected: { borderColor: t.accent },
    dot: { width: DOT, height: DOT, borderRadius: radius.full, backgroundColor: t.accent },
    label: { flexShrink: 1 },
  })
