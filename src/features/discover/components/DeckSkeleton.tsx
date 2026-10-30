import { StyleSheet, View } from 'react-native'
import { radius, Skeleton, space, useStyles, type Theme } from '@/ui'

// Misma forma que la tarjeta real (portada a sangre + bloque de texto abajo): la carga no hace saltar el layout.
export function DeckSkeleton() {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel="Cargando canciones">
      <View style={styles.card}>
        <View style={styles.content}>
          <Skeleton width={72} height={18} />
          <Skeleton width="80%" height={28} />
          <Skeleton width="50%" height={20} />
          <Skeleton width={140} height={14} style={styles.caption} />
        </View>
      </View>
      <View style={styles.row}>
        <Skeleton width={64} height={64} radius={radius.full} />
        <Skeleton width={56} height={56} radius={radius.full} />
        <Skeleton width={64} height={64} radius={radius.full} />
      </View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    card: {
      flex: 1,
      borderRadius: radius.md,
      backgroundColor: t.surface,
      justifyContent: 'flex-end',
    },
    content: { padding: space.lg, gap: space.sm },
    caption: { marginTop: space.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xxl,
      paddingVertical: space.lg,
    },
  })
