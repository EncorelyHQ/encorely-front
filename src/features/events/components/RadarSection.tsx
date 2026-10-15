import { useState } from 'react'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { useLike, useOpenChatWith } from '@/features/match/hooks'
import { AFFINITY_EXPLAINER } from '@/features/social'
import { userMessage } from '@/lib/api/errors'
import { Button, EmptyState, ErrorState, Icon, Sheet, Text, UsersIcon, VinylRecordIcon, radius, space, useStyles, type Theme } from '@/ui'
import { useGenreLookup } from '../genres'
import { isEventPast, isNotAttending, isRadarLocked, useRadar, useSwipesMissing } from '../hooks'
import { RadarPersonRow, RadarPersonSkeleton } from './RadarPersonRow'

type RadarSectionProps = {
  eventId: string
  eventName: string
  going: boolean
  // Mientras el PUT de asistencia no confirme, el back respondería not_attending: se espera.
  attendancePending: boolean
}

const SKELETONS = [0, 1, 2]

export function RadarSection({ eventId, eventName, going, attendancePending }: RadarSectionProps) {
  const styles = useStyles(makeStyles)
  const router = useRouter()
  const radar = useRadar(eventId, going && !attendancePending)
  const locked = isRadarLocked(radar.error)
  const missing = useSwipesMissing(locked)
  const { sentence } = useGenreLookup()
  const like = useLike({ eventId, eventName })
  const chat = useOpenChatWith()

  if (!going || isNotAttending(radar.error)) {
    return (
      <View style={styles.hint}>
        <Icon icon={UsersIcon} size={24} color="textMuted" />
        <Text variant="callout" color="textMuted" style={styles.hintText}>
          Cuando marques que vas, aquí verás quién más va y escucha lo mismo que tú.
        </Text>
      </View>
    )
  }

  if (isEventPast(radar.error)) {
    return <EmptyState icon={UsersIcon} title="Este concierto ya pasó." />
  }

  if (radar.isPending) {
    return (
      <View accessible accessibilityRole="progressbar" accessibilityLabel="Buscando quién más va">
        <SectionTitle />
        {SKELETONS.map((i) => (
          <RadarPersonSkeleton key={i} />
        ))}
      </View>
    )
  }

  if (locked) {
    const title = missing
      ? `Califica ${missing} ${missing === 1 ? 'canción' : 'canciones'} más para ver quién va`
      : 'Califica unas canciones más para ver quién va'
    return (
      <EmptyState
        icon={VinylRecordIcon}
        title={title}
        body="Con lo que te gusta te mostramos a la gente que va y escucha lo mismo."
        action={{ label: 'Ir a Descubrir', onPress: () => router.push('/') }}
      />
    )
  }

  if (radar.isError) {
    return (
      <ErrorState
        title="No pudimos ver quién va"
        message={userMessage(radar.error)}
        onRetry={() => void radar.refetch()}
        retrying={radar.isFetching}
      />
    )
  }

  if (radar.data.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Todavía nadie más con tu música marcó que va"
        body="Vuelve más cerca de la fecha."
        action={{ label: 'Actualizar', onPress: () => void radar.refetch(), loading: radar.isFetching }}
      />
    )
  }

  return (
    <View>
      <SectionTitle />
      {radar.data.map((person) => (
        <RadarPersonRow
          key={person.userId}
          person={person}
          genres={sentence(person.sharedGenres)}
          onLike={(p) => like.mutate(p)}
          onOpenChat={(p) => void chat.open(p.userId)}
          liking={like.isPending && like.variables?.userId === person.userId}
          openingChat={chat.opening === person.userId}
        />
      ))}
    </View>
  )
}

function SectionTitle() {
  const styles = useStyles(makeStyles)
  const [explaining, setExplaining] = useState(false)
  return (
    <View style={styles.title}>
      <Text variant="title2" accessibilityRole="header">
        Quién más va
      </Text>
      <Text variant="footnote" color="textMuted">
        Primero quienes más comparten tu música.
      </Text>
      <View style={styles.how}>
        <Button label="¿Cómo lo calculamos?" variant="ghost" fullWidth={false} onPress={() => setExplaining(true)} />
      </View>
      <Sheet visible={explaining} onClose={() => setExplaining(false)} title="¿Cómo lo calculamos?">
        {AFFINITY_EXPLAINER.map((paragraph) => (
          <Text key={paragraph} variant="body" color="textMuted">
            {paragraph}
          </Text>
        ))}
        <Button label="Entendido" variant="secondary" onPress={() => setExplaining(false)} />
      </Sheet>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    title: { gap: space.xs, paddingBottom: space.xs },
    // El botón fantasma trae su propio padding: se alinea el texto con el título.
    how: { alignItems: 'flex-start', marginLeft: -space.xl },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    hintText: { flex: 1 },
  })
