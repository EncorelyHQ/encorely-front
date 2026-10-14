import { useMemo } from 'react'
import { Pressable, SectionList, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { formatEventDate, lineupText } from '@/features/events/format'
import { Button, EmptyState, radius, Screen, Skeleton, space, Text, TicketIcon, useStyles, type Theme } from '@/ui'
import { AdminGate, AdminQueryError } from '../components/AdminGate'
import { StatusTag } from '../components/StatusTag'
import { useAdminEvents } from '../hooks/queries'
import { PlusIcon } from '../icons'
import type { AdminEvent } from '../types'

export function AdminEventsScreen() {
  return (
    <AdminGate title="Conciertos">
      <AdminEvents />
    </AdminGate>
  )
}

type Section = { title: string; data: AdminEvent[] }

function splitByTime(events: readonly AdminEvent[], now: number): Section[] {
  const upcoming = events.filter((e) => Date.parse(e.startsAt) > now)
  // Pasados: el más reciente primero, que es el que más se corrige.
  const past = events.filter((e) => Date.parse(e.startsAt) <= now).reverse()
  const sections: Section[] = []
  if (upcoming.length) sections.push({ title: 'Próximos', data: upcoming })
  if (past.length) sections.push({ title: 'Pasados', data: past })
  return sections
}

function AdminEvents() {
  const styles = useStyles(makeStyles)
  const events = useAdminEvents()
  // Referencia = momento de la última carga: puro durante el render y se actualiza con cada refetch.
  const sections = useMemo(() => splitByTime(events.data ?? [], events.dataUpdatedAt), [events.data, events.dataUpdatedAt])
  const header = <Stack.Screen options={{ title: 'Conciertos' }} />
  const footer = <Button label="Nuevo concierto" icon={PlusIcon} onPress={() => router.push('/admin/events/new')} />

  if (events.isPending) {
    return (
      <Screen edges={[]} footer={footer}>
        {header}
        <View style={styles.skeletons} accessible accessibilityLabel="Cargando conciertos">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={88} radius={radius.sm + 4} />
          ))}
        </View>
      </Screen>
    )
  }

  if (events.isError) {
    return (
      <Screen edges={[]}>
        {header}
        <AdminQueryError
          title="No pudimos cargar los conciertos"
          error={events.error}
          onRetry={() => void events.refetch()}
          retrying={events.isRefetching}
        />
      </Screen>
    )
  }

  return (
    <Screen edges={[]} padded={false} footer={footer}>
      {header}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sections.length ? styles.list : styles.empty}
        refreshing={events.isRefetching}
        onRefresh={() => void events.refetch()}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text variant="caption" color="textMuted" style={styles.sectionTitle} accessibilityRole="header">
            {section.title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <AdminEventRow
            event={item}
            first={index === 0}
            last={index === section.data.length - 1}
            onPress={() => router.push({ pathname: '/admin/events/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={TicketIcon}
            title="Todavía no hay conciertos"
            body="Crea el primero con su fecha, lugar y lineup. Aparecerá en la pestaña Conciertos."
          />
        }
      />
    </Screen>
  )
}

type RowProps = { event: AdminEvent; first: boolean; last: boolean; onPress: () => void }

function AdminEventRow({ event, first, last, onPress }: RowProps) {
  const styles = useStyles(makeStyles)
  const date = formatEventDate(event.startsAt)
  const lineup = lineupText(event.artistLineup)
  const attendees =
    event.attendeeCount === 0 ? null : event.attendeeCount === 1 ? '1 asistente' : `${event.attendeeCount} asistentes`
  const label = [
    event.name,
    `${date.long}, ${date.time}`,
    `${event.venue}, ${event.city}`,
    event.isPublished ? null : 'Oculto en la app',
    attendees,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el concierto para editarlo"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first ? styles.rowFirst : null,
        last ? styles.rowLast : styles.rowDivider,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text variant="headline" numberOfLines={2}>
        {event.name}
      </Text>
      <Text variant="data" color="textMuted">
        {date.weekdayShort} {date.day} {date.monthShort} · {date.time}
      </Text>
      {lineup && lineup !== event.name ? (
        <Text variant="footnote" color="textMuted" numberOfLines={2}>
          {lineup}
        </Text>
      ) : null}
      <Text variant="footnote" color="textSubtle" numberOfLines={2}>
        {event.venue} · {event.city}
      </Text>
      {!event.isPublished || attendees ? (
        <View style={styles.meta}>
          {!event.isPublished ? <StatusTag label="Oculto" tone="neutral" /> : null}
          {attendees ? (
            <Text variant="caption" color="textMuted">
              {attendees}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

const GROUP_RADIUS = space.md

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.xxl },
    empty: { flexGrow: 1 },
    skeletons: { gap: space.sm, paddingTop: space.xl },
    sectionTitle: { paddingHorizontal: space.xs, marginBottom: space.sm, marginTop: space.lg, letterSpacing: 0.6 },
    row: {
      gap: space.xs,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: t.surface,
    },
    rowFirst: { borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS },
    rowLast: { borderBottomLeftRadius: GROUP_RADIUS, borderBottomRightRadius: GROUP_RADIUS },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
    pressed: { backgroundColor: t.surface2 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  })
