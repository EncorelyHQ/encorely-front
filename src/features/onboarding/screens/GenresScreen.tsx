import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { userMessage } from '@/lib/api/errors'
import { catalogApi, meApi } from '@/lib/api/endpoints'
import type { Me } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useSession } from '@/lib/session/SessionContext'
import { Alert, Button, Chip, EmptyState, ErrorState, haptics, MusicNotesIcon, Screen, Skeleton, space, Text, touch, useStyles, type Theme } from '@/ui'
import { cityError, resolveCity, validateBirthDate, validateDisplayName } from '@/features/shared/profileRules'
import { StepStub } from '../components/StepStub'
import { getDraft, resetDraft, updateDraft } from '../draftStore'
import { onboardingSubmitErrors, type StepOneField } from '../lib/draft'
import { knownGenres, MAX_GENRES, MIN_GENRES, toggleGenre } from '../lib/genres'
import { useSeededDraft } from '../useOnboardingDraft'

// Anchos en múltiplos de la escala: el esqueleto sugiere chips de largo variable sin inventar nombres.
const SKELETON_WIDTHS = [4, 5, 3, 6, 4, 3, 5, 4, 6, 3].map((n) => space.xl * n)

function backToStepOne(errors: Partial<Record<StepOneField, string>>) {
  updateDraft({ stepOneErrors: errors })
  if (router.canGoBack()) router.back()
  else router.replace('/about-you')
}

export function GenresScreen() {
  const styles = useStyles(makeStyles)
  const { applyMe } = useSession()
  const draft = useSeededDraft()
  const [genresError, setGenresError] = useState<string | null>(null)
  const [general, setGeneral] = useState<string | null>(null)
  const completed = useRef(false)

  const genres = useQuery({ queryKey: queryKeys.genres, queryFn: catalogApi.genres })
  const catalog = genres.data ?? []
  const selected = draft.genres
  const count = selected.length
  const atMax = count >= MAX_GENRES

  // El borrador se limpia al salir del grupo ya terminado, no antes: así no destella vacío mientras el guard navega.
  useEffect(
    () => () => {
      if (completed.current) resetDraft()
    },
    [],
  )

  const save = useMutation({
    mutationFn: meApi.update,
    onSuccess: (me: Me) => {
      if (me.onboardingCompleted) completed.current = true
      else setGeneral('Guardamos tus datos, pero falta algo para terminar. Revisa el paso anterior.')
      applyMe(me)
    },
    onError: (error) => {
      haptics.warning()
      const mapped = onboardingSubmitErrors(error)
      if (Object.keys(mapped.stepOne).length) {
        backToStepOne(mapped.stepOne)
        return
      }
      setGenresError(mapped.genres)
      setGeneral(mapped.general)
      if (mapped.genres) void genres.refetch()
    },
  })

  const toggle = (slug: string) => {
    updateDraft({ genres: toggleGenre(getDraft().genres, slug) })
    if (genresError) setGenresError(null)
    if (general) setGeneral(null)
  }

  const finish = () => {
    if (save.isPending) return
    const current = getDraft()
    const picked = knownGenres(current.genres, catalog)
    if (picked.length < MIN_GENRES) {
      haptics.warning()
      setGenresError('Elige al menos un género para terminar.')
      return
    }

    // Si se llegó aquí sin pasar por el paso 1 (o con datos viejos), el paso 1 se corrige allá.
    const birth = validateBirthDate(current)
    const city = resolveCity(current.cityChoice, current.otherCity)
    const stepOne: Partial<Record<StepOneField, string>> = {}
    const nameMsg = validateDisplayName(current.displayName)
    const cityMsg = cityError(current.cityChoice, current.otherCity)
    if (nameMsg) stepOne.displayName = nameMsg
    if (!birth.ok) stepOne.birthDate = birth.message
    if (cityMsg) stepOne.city = cityMsg
    if (!birth.ok || !city || Object.keys(stepOne).length) {
      haptics.warning()
      backToStepOne(stepOne)
      return
    }

    setGeneral(null)
    setGenresError(null)
    save.mutate({ displayName: current.displayName.trim(), birthDate: birth.iso, city, genres: picked })
  }

  const statusLine =
    genresError ??
    (count === 0
      ? `Elige de ${MIN_GENRES} a ${MAX_GENRES}.`
      : atMax
        ? 'Llegaste al máximo. Quita uno para cambiarlo.'
        : `Puedes elegir hasta ${MAX_GENRES}.`)

  const footer = (
    <>
      {general ? <Alert message={general} /> : null}
      <View style={styles.counter}>
        <Text
          variant="footnote"
          color={genresError ? 'danger' : 'textMuted'}
          style={styles.counterText}
          accessibilityLiveRegion="polite"
        >
          {statusLine}
        </Text>
        <Text variant="data" color={atMax ? 'accentText' : 'text'} accessibilityLabel={`${count} de ${MAX_GENRES} elegidos`}>
          {count}/{MAX_GENRES}
        </Text>
      </View>
      <Button label="Terminar" size="lg" loading={save.isPending} onPress={finish} disabled={!genres.isSuccess || !catalog.length} />
    </>
  )

  return (
    <Screen mode="scroll" edges={[]} footer={footer}>
      <View style={styles.header}>
        <StepStub step={2} total={2} />
        <Text variant="title1" accessibilityRole="header">
          ¿Qué música escuchas?
        </Text>
        <Text variant="body" color="textMuted">
          Con esto armamos tus primeras canciones para calificar.
        </Text>
      </View>

      {genres.isPending ? (
        <View style={styles.chips} accessible accessibilityLabel="Cargando géneros" accessibilityRole="progressbar">
          {SKELETON_WIDTHS.map((width, i) => (
            <Skeleton key={i} width={width} height={touch.min} />
          ))}
        </View>
      ) : genres.isError ? (
        <ErrorState
          title="No pudimos cargar los géneros"
          message={userMessage(genres.error)}
          onRetry={() => void genres.refetch()}
          retrying={genres.isFetching}
        />
      ) : !catalog.length ? (
        <EmptyState
          icon={MusicNotesIcon}
          title="Todavía no hay géneros para elegir"
          body="El catálogo está vacío por ahora. Intenta de nuevo en un rato."
          action={{ label: 'Reintentar', onPress: () => void genres.refetch(), loading: genres.isFetching }}
        />
      ) : (
        <View style={styles.chips}>
          {catalog.map((genre) => {
            const isSelected = selected.includes(genre.slug)
            return (
              <Chip
                key={genre.id}
                label={genre.name}
                selected={isSelected}
                disabled={save.isPending || (atMax && !isSelected)}
                onPress={() => toggle(genre.slug)}
              />
            )
          })}
        </View>
      )}
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    header: { gap: space.md, marginBottom: space.xl },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    counterText: { flex: 1 },
  })
