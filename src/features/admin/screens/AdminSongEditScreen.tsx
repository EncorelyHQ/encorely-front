import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { genreName, useGenreLookup } from '@/features/events/genres'
import { isApiError, userMessage } from '@/lib/api/errors'
import {
  Button,
  Chip,
  EmptyState,
  haptics,
  ListRow,
  ListSection,
  LoadingState,
  MusicNotesIcon,
  Screen,
  space,
  Text,
  TextField,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { AdminGate, AdminQueryError } from '../components/AdminGate'
import { Cover } from '../components/Cover'
import { PreviewButton } from '../components/PreviewButton'
import { useAdminSongs, useUpdateSong } from '../hooks/queries'
import { useTrackPreview } from '../hooks/useTrackPreview'
import {
  formToSongRequest,
  songStatsLabel,
  songToForm,
  validateSongForm,
  type SongFormErrors,
  type SongFormValues,
} from '../model/songs'
import type { AdminSong } from '../types'

export function AdminSongEditScreen({ songId }: { songId: string }) {
  return (
    <AdminGate title="Editar canción">
      <EditSong songId={songId} />
    </AdminGate>
  )
}

function EditSong({ songId }: { songId: string }) {
  const songs = useAdminSongs()
  const song = songs.data?.find((s) => s.id === songId)
  const header = <Stack.Screen options={{ title: 'Editar canción' }} />

  if (songs.isPending) {
    return (
      <Screen edges={[]}>
        {header}
        <LoadingState label="Cargando canción" />
      </Screen>
    )
  }
  if (songs.isError) {
    return (
      <Screen edges={[]}>
        {header}
        <AdminQueryError
          title="No pudimos cargar la canción"
          error={songs.error}
          onRetry={() => void songs.refetch()}
          retrying={songs.isRefetching}
        />
      </Screen>
    )
  }
  if (!song) {
    return (
      <Screen edges={[]}>
        {header}
        <EmptyState
          icon={MusicNotesIcon}
          title="No encontramos esta canción"
          body="Vuelve a la lista y búscala de nuevo."
          action={{ label: 'Volver a canciones', onPress: () => router.back() }}
        />
      </Screen>
    )
  }
  return <SongForm key={song.id} song={song} />
}

function SongForm({ song }: { song: AdminSong }) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const update = useUpdateSong()
  const { genres } = useGenreLookup()
  const preview = useTrackPreview(() => toast.show('No pudimos reproducir la vista previa. Intenta otra vez.', 'danger'))
  const [values, setValues] = useState<SongFormValues>(() => songToForm(song))
  const [submitted, setSubmitted] = useState(false)
  // El back no deja cambiar el género si ya la calificaron (dejaría inconsistente el ADN): se avisa antes.
  const genreLocked = song.likes + song.dislikes > 0

  const errors: SongFormErrors = submitted ? validateSongForm(values) : {}
  const set = <K extends keyof SongFormValues>(key: K, value: SongFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const submit = () => {
    setSubmitted(true)
    if (Object.values(validateSongForm(values)).some(Boolean)) {
      haptics.warning()
      return
    }
    update.mutate(
      { id: song.id, body: formToSongRequest(song, values) },
      {
        onSuccess: () => {
          toast.show('Cambios guardados.', 'success')
          router.back()
        },
      },
    )
  }

  const fieldError = (name: keyof SongFormErrors) =>
    errors[name] ?? (isApiError(update.error) ? update.error.field(name) : null)

  return (
    <Screen
      edges={[]}
      mode="form"
      contentStyle={styles.content}
      footer={
        <>
          {update.error ? (
            <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
              {userMessage(update.error)}
            </Text>
          ) : null}
          <Button label="Guardar cambios" size="lg" loading={update.isPending} onPress={submit} />
        </>
      }
    >
      <Stack.Screen options={{ title: 'Editar canción' }} />

      <View style={styles.summary}>
        <Cover uri={values.coverUrl.trim() || song.coverUrl} size={96} />
        <View style={styles.summaryTexts}>
          <Text variant="headline" numberOfLines={3}>
            {song.title}
          </Text>
          <Text variant="footnote" color="textMuted">
            {song.artist}
          </Text>
          <Text variant="data" color="textMuted">
            {songStatsLabel(song)}
          </Text>
          {song.previewUrl ? (
            <PreviewButton
              title={song.title}
              playing={preview.playingId === song.id}
              loading={preview.loadingId === song.id}
              onPress={() => song.previewUrl && preview.toggle(song.id, song.previewUrl)}
            />
          ) : null}
        </View>
      </View>

      <ListSection footer="Fuera del feed no aparece en Descubrir. Lo que ya calificaron se conserva.">
        <ListRow title="En el feed" switchValue={values.isActive} onSwitchChange={(value) => set('isActive', value)} />
      </ListSection>

      <TextField label="Título" value={values.title} onChangeText={(t) => set('title', t)} error={fieldError('title')} maxLength={200} />
      <TextField label="Artista" value={values.artist} onChangeText={(t) => set('artist', t)} error={fieldError('artist')} maxLength={200} />

      <View style={styles.group}>
        <Text variant="callout" color="textMuted" accessibilityRole="header">
          Género
        </Text>
        {genreLocked ? (
          <Text variant="footnote" color="textSubtle">
            {genreName(song.genre, genres)}. No se puede cambiar porque ya la calificaron: si está mal, sácala del feed y
            agrégala de nuevo.
          </Text>
        ) : genres?.length ? (
          <View style={styles.chips}>
            {genres.map((g) => (
              <Chip key={g.slug} label={g.name} selected={values.genre === g.slug} onPress={() => set('genre', g.slug)} />
            ))}
          </View>
        ) : (
          <Text variant="footnote" color="textMuted">
            Cargando géneros…
          </Text>
        )}
        {fieldError('genre') ? (
          <Text variant="footnote" color="danger">
            {fieldError('genre')}
          </Text>
        ) : null}
      </View>

      <TextField
        label="Portada"
        value={values.coverUrl}
        onChangeText={(t) => set('coverUrl', t)}
        error={fieldError('coverUrl')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={500}
      />
      <TextField
        label="Vista previa (opcional)"
        helper="Audio de 30 segundos. Sin esto la canción no suena en Descubrir."
        value={values.previewUrl}
        onChangeText={(t) => set('previewUrl', t)}
        error={fieldError('previewUrl')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={500}
      />
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    content: { gap: space.xl, paddingBottom: space.xxl },
    summary: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
    summaryTexts: { flex: 1, gap: space.xs },
    group: { gap: space.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  })
