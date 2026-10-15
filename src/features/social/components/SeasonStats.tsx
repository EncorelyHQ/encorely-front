import { StyleSheet, View } from 'react-native'
import type { ProfileStats } from '@/lib/api/types'
import { Text, radius, space, useStyles, type Theme } from '@/ui'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

// "Marcados", no "asistidos": el back solo sabe que la persona marcó que iba, no que fue.
export function SeasonStats({ stats }: { stats: ProfileStats }) {
  const styles = useStyles(makeStyles)
  const items = [
    { value: stats.swipeCount, label: plural(stats.swipeCount, 'canción calificada', 'canciones calificadas') },
    { value: stats.genresExplored, label: plural(stats.genresExplored, 'género explorado', 'géneros explorados') },
    { value: stats.eventsMarked, label: plural(stats.eventsMarked, 'concierto marcado', 'conciertos marcados') },
  ]
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.stat} accessible accessibilityLabel={`${item.value} ${item.label}`}>
          <Text variant="data" style={styles.value}>
            {item.value}
          </Text>
          <Text variant="footnote" color="textMuted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    stat: {
      flexGrow: 1,
      flexBasis: 96,
      gap: space.xs,
      padding: space.md,
      borderRadius: radius.md,
      backgroundColor: t.surface,
    },
    value: { fontSize: 26, lineHeight: 30 },
  })
