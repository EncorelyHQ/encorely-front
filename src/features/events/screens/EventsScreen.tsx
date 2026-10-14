import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { CalendarXIcon } from 'phosphor-react-native/src/icons/CalendarX'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native'
import { userMessage } from '@/lib/api/errors'
import type { EventSummary, Me } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { EmptyState, ErrorState, Screen, Text, space, useStyles, useTheme, type Theme } from '@/ui'
import { CityFilter } from '../components/CityFilter'
import { EventRow, EventRowSkeleton } from '../components/EventRow'
import { cityOptions, defaultCity, groupEvents, type EventSection } from '../grouping'
import { useEventsList, useManualRefresh } from '../hooks'

const SKELETON_ROWS = [0, 1, 2, 3]

export function EventsScreen() {
  const styles = useStyles(makeStyles)
  const theme = useTheme()
  const router = useRouter()
  const qc = useQueryClient()

  // La ciudad por defecto sale del perfil ya cacheado; si no está, se muestran todas sin pedir /me solo por esto.
  const [userCity] = useState(() => qc.getQueryData<Me>(queryKeys.me)?.city ?? null)
  const options = useMemo(() => cityOptions(userCity), [userCity])
  const [city, setCity] = useState<string | undefined>(() => defaultCity(userCity))

  const list = useEventsList(city)
  const { refreshing, onRefresh } = useManualRefresh(list.refetch)
  const sections = useMemo(() => groupEvents(list.data ?? []), [list.data])

  const openEvent = useCallback((event: EventSummary) => router.push(`/event/${event.id}`), [router])

  const header = (
    <View style={styles.header}>
      <Text variant="title1" accessibilityRole="header">
        Conciertos
      </Text>
      <View style={styles.bleed}>
        <CityFilter options={options} value={city} onChange={setCity} />
      </View>
    </View>
  )

  let empty: ReactElement
  if (list.isPending) {
    empty = (
      <View style={styles.skeletons} accessible accessibilityLabel="Cargando conciertos" accessibilityRole="progressbar">
        {SKELETON_ROWS.map((i) => (
          <EventRowSkeleton key={i} />
        ))}
      </View>
    )
  } else if (list.isError) {
    empty = (
      <ErrorState
        title="No pudimos cargar los conciertos"
        message={userMessage(list.error)}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (city) {
    empty = (
      <EmptyState
        icon={CalendarXIcon}
        title={`No hay conciertos próximos en ${city}`}
        body="Mira lo que viene en otras ciudades o vuelve en unos días."
        action={{ label: 'Ver todas las ciudades', onPress: () => setCity(undefined) }}
      />
    )
  } else {
    empty = (
      <EmptyState
        icon={CalendarXIcon}
        title="Todavía no hay conciertos publicados"
        body="Estamos sumando fechas. Vuelve en unos días."
        action={{ label: 'Actualizar', onPress: onRefresh, loading: refreshing }}
      />
    )
  }

  return (
    <Screen padded={false}>
      <SectionList<EventSummary, EventSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventRow event={item} onPress={openEvent} />}
        renderSectionHeader={({ section }) => (
          <Text variant="headline" color="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
            progressBackgroundColor={theme.surface}
          />
        }
      />
    </Screen>
  )
}

function Separator() {
  return <View style={separatorStyles.gap} />
}

const separatorStyles = StyleSheet.create({ gap: { height: space.sm } })

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    content: { flexGrow: 1, paddingHorizontal: space.gutter, paddingBottom: space.xxl },
    header: { paddingTop: space.lg, gap: space.lg },
    // Los chips corren de borde a borde para que se note que hay más al deslizar.
    bleed: { marginHorizontal: -space.gutter },
    sectionTitle: { paddingTop: space.xl, paddingBottom: space.md },
    skeletons: { gap: space.sm, paddingTop: space.xl },
  })
