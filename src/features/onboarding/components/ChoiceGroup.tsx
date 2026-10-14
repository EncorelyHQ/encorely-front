import { Pressable, StyleSheet, View } from 'react-native'
import { haptics, radius, space, Text, touch, useStyles, useTheme, type Theme } from '@/ui'

type Option<T extends string> = { value: T; label: string }

type ChoiceGroupProps<T extends string> = {
  label: string
  options: readonly Option<T>[]
  value: T | null
  onChange: (value: T) => void
  error?: string | null
}

// Selección única con semántica de radio (Chip es checkbox y aquí solo vale una ciudad).
export function ChoiceGroup<T extends string>({ label, options, value, onChange, error }: ChoiceGroupProps<T>) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)

  return (
    <View style={styles.wrap}>
      <Text variant="callout" color="textMuted">
        {label}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              accessibilityHint={error ?? undefined}
              onPress={() => {
                if (selected) return
                haptics.selection()
                onChange(option.value)
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? theme.accent : pressed ? theme.surface2 : theme.surface,
                  borderColor: selected ? theme.accent : error ? theme.danger : theme.borderInput,
                },
              ]}
            >
              <Text variant="callout" color={selected ? 'onAccent' : 'text'}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.xs + 2 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    option: {
      minHeight: touch.comfortable,
      paddingHorizontal: space.lg,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
