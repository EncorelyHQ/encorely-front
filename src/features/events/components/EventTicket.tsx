import { StyleSheet, View } from 'react-native'
import { Icon, Text, TicketCard, TicketIcon, space, useStyles, type Theme } from '@/ui'
import { attendeesLabel, eventAccessibilityLabel, formatEventDate, lineupText } from '../format'
import type { EventDetail } from '../types'

// El concierto como boleta: arriba el cartel, en el talón los datos de entrada en mono.
export function EventTicket({ event }: { event: EventDetail }) {
  const styles = useStyles(makeStyles)
  const date = formatEventDate(event.startsAt)
  const lineup = lineupText(event.artistLineup)
  const attendees = attendeesLabel(event.attendeeCount)

  return (
    <View accessible accessibilityLabel={eventAccessibilityLabel(event)}>
      <TicketCard
        stub={
          <View style={styles.stub}>
            <View style={styles.fields}>
              <Field label="Fecha" value={`${date.weekdayShort} ${date.day} ${date.monthShort}`} />
              <Field label="Hora" value={date.time} />
            </View>
            <Field label="Lugar" value={`${event.venue} · ${event.city}`} mono={false} />
            {attendees ? (
              <Text variant="footnote" color="onTicketMuted">
                {attendees}
              </Text>
            ) : null}
          </View>
        }
      >
        {event.iAmGoing ? (
          <View style={styles.going}>
            <Icon icon={TicketIcon} size={16} color="ticketAccent" weight="fill" />
            <Text variant="caption" color="ticketAccent">
              Vas a ir
            </Text>
          </View>
        ) : null}
        <Text variant="title1" color="onTicket">
          {event.name}
        </Text>
        {lineup && lineup !== event.name ? (
          <Text variant="callout" color="onTicketMuted">
            {lineup}
          </Text>
        ) : null}
        {event.description ? (
          <Text variant="footnote" color="onTicket" style={styles.description}>
            {event.description}
          </Text>
        ) : null}
      </TicketCard>
    </View>
  )
}

function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.field}>
      <Text variant="caption" color="onTicketMuted">
        {label}
      </Text>
      <Text variant={mono ? 'data' : 'callout'} color="onTicket">
        {value}
      </Text>
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    stub: { gap: space.md },
    fields: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.md },
    field: { gap: space.xs / 2 },
    going: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    description: { marginTop: space.xs },
  })
