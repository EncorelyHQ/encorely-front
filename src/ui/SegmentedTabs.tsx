import { Pressable, StyleSheet, View } from 'react-native'
import { haptics } from './haptics'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, touch, type Theme } from './tokens'

type Segment<T extends string> = { value: T; label: string }

type SegmentedTabsProps<T extends string> = {
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
  accessibilityLabel: string
}

export function SegmentedTabs<T extends string>({ segments, value, onChange, accessibilityLabel }: SegmentedTabsProps<T>) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {segments.map((segment) => {
        const selected = segment.value === value
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            onPress={() => {
              if (selected) return
              haptics.selection()
              onChange(segment.value)
            }}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.selected : null,
              pressed && !selected ? { backgroundColor: theme.surface2 } : null,
            ]}
          >
            <Text variant="callout" color={selected ? 'text' : 'textMuted'} align="center">
              {segment.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
      padding: space.xs,
      borderRadius: radius.sm + 4,
      backgroundColor: t.surface,
    },
    segment: {
      flexGrow: 1,
      flexBasis: 120,
      minHeight: touch.min,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: t.surface2, borderWidth: 1, borderColor: t.borderInput },
  })
