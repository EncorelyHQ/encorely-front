import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import type { EventSummary } from '@/lib/api/types'
import { Icon, Skeleton, Text, TicketIcon, radius, space, useStyles, type Theme } from '@/ui'
import { attendeesParts, eventAccessibilityLabel, formatEventDate, lineupText } from '../format'

type EventRowProps = { event: EventSummary; onPress: (event: EventSummary) => void }

// Con letra muy grande la columna de fecha se come el ancho: la fecha pasa arriba en una línea.
const STACK_AT_FONT_SCALE = 1.5

export function EventRow({ event, onPress }: EventRowProps) {
  const styles = useStyles(makeStyles)
  const { fontScale } = useWindowDimensions()
  const stacked = fontScale >= STACK_AT_FONT_SCALE
  const date = formatEventDate(event.startsAt)
  const lineup = lineupText(event.artistLineup)
  const attendees = attendeesParts(event.attendeeCount)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={eventAccessibilityLabel(event)}
      accessibilityHint="Abre el concierto"
      onPress={() => onPress(event)}
      style={({ pressed }) => [styles.row, stacked && styles.rowStacked, pressed && styles.pressed]}
    >
      <View style={[styles.date, stacked && styles.dateStacked]}>
        <Text variant="title1" style={styles.day}>
          {date.day}
        </Text>
        <View style={stacked ? styles.dateMetaStacked : styles.dateMeta}>
          <Text variant="data" color="textMuted">
            {date.monthShort}
          </Text>
          <Text variant="data" color="textMuted" numberOfLines={1}>
            {date.time}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text variant="headline" numberOfLines={2}>
          {event.name}
        </Text>
        {lineup && lineup !== event.name ? (
          <Text variant="footnote" color="textMuted" numberOfLines={2}>
            {lineup}
          </Text>
        ) : null}
        <Text variant="footnote" color="textSubtle" numberOfLines={2}>
          {event.venue} · {event.city}
        </Text>
        {event.iAmGoing || attendees ? (
          <View style={styles.meta}>
            {event.iAmGoing ? (
              <View style={styles.going}>
                <Icon icon={TicketIcon} size={16} color="accentText" weight="fill" />
                <Text variant="caption" color="accentText">
                  Vas
                </Text>
              </View>
            ) : null}
            {attendees ? (
              <Text variant="footnote" color="textMuted">
                <Text variant="data" color="textMuted">
                  {attendees.count}
                </Text>
                {attendees.rest}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

// Misma silueta que la fila para que el contenido no salte al llegar.
export function EventRowSkeleton() {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.row} accessible={false}>
      <View style={styles.date}>
        <Skeleton width={36} height={28} />
        <Skeleton width={44} height={12} />
        <Skeleton width={52} height={12} />
      </View>
      <View style={styles.info}>
        <Skeleton width="80%" height={18} />
        <Skeleton width="55%" height={14} />
        <Skeleton width="65%" height={14} />
      </View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: space.lg,
      padding: space.lg,
      borderRadius: radius.md,
      backgroundColor: t.surface,
    },
    rowStacked: { flexDirection: 'column', gap: space.sm },
    // Confirma el toque sin esperar a la navegación.
    pressed: { backgroundColor: t.surface2, transform: [{ scale: 0.98 }] },
    date: {
      // Ancho fijo: la línea divisoria queda alineada en toda la lista aunque la hora sea "8:30 p. m.".
      width: space.xxxl * 2,
      alignItems: 'flex-start',
      gap: space.xs,
      paddingRight: space.lg,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: t.border,
    },
    dateStacked: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: space.sm,
      paddingRight: 0,
      borderRightWidth: 0,
    },
    day: { color: t.text },
    dateMeta: { gap: space.xs / 2 },
    dateMetaStacked: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    info: { flex: 1, gap: space.xs },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: space.xs },
    going: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  })
