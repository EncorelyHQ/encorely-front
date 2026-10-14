import { StyleSheet, View } from 'react-native'
import { radius, space, Text, useStyles, useTheme, type Theme } from '@/ui'

export type TagTone = 'attention' | 'done' | 'neutral' | 'danger'

const TEXT_COLOR = { attention: 'accentText', done: 'verified', neutral: 'textMuted', danger: 'danger' } as const

// Etiqueta de estado con borde del mismo color: sin rellenos de color para no gastar el acento.
export function StatusTag({ label, tone }: { label: string; tone: TagTone }) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const color = theme[TEXT_COLOR[tone]]
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text variant="caption" color={TEXT_COLOR[tone]}>
        {label}
      </Text>
    </View>
  )
}

// Conteo de pendientes: el único relleno de acento del panel, porque es lo que pide acción.
export function CountBadge({ count, label }: { count: string; label: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.badge} accessible accessibilityLabel={label}>
      <Text variant="data" color="onAccent">
        {count}
      </Text>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    tag: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
    },
    badge: {
      minWidth: space.xl,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: t.accent,
      alignItems: 'center',
    },
  })
