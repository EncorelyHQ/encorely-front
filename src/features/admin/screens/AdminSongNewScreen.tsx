import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { genreName, useGenreLookup } from '@/features/events/genres'
import { userMessage } from '@/lib/api/errors'
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  MusicNotesIcon,
  radius,
  Screen,
  Sheet,
  Skeleton,
  space,
  Text,
  TextField,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { AdminGate } from '../components/AdminGate'
import { Cover } from '../components/Cover'
import { ITunesAttribution } from '../components/ITunesAttribution'
import { PreviewButton } from '../components/PreviewButton'
import { StatusTag } from '../components/StatusTag'
import { MIN_TERM, useAdminSongs, useCreateSong, useITunesSearch } from '../hooks/queries'
import { useTrackPreview } from '../hooks/useTrackPreview'
import { MagnifyingGlassIcon } from '../icons'
import { guessGenre, trackToRequest } from '../model/songs'
import type { ITunesTrack } from '../types'

export function AdminSongNewScreen() {
  return (
    <AdminGate title="Agregar canción">
      <AdminSongNew />
    </AdminGate>
  )
}

const DEBOUNCE_MS = 400

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

function AdminSongNew() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term, DEBOUNCE_MS)
  const search = useITunesSearch(debounced)
  const catalog = useAdminSongs()
  const preview = useTrackPreview(() => toast.show('No pudimos reproducir la vista previa. Intenta otra vez.', 'danger'))
  const [selected, setSelected] = useState<ITunesTrack | null>(null)
  const create = useCreateSong()

  // Marca lo que ya está en el catálogo para no intentar duplicarlo (el back respondería 409).
  const inCatalog = useMemo(
    () => new Set((catalog.data ?? []).map((s) => s.iTunesTrackId).filter((id): id is number => id !== null)),
    [catalog.data],
  )

  const searching = debounced.trim().length >= MIN_TERM
  const typing = term.trim() !== debounced.trim()

  let body: ReactNode
  if (!searching) {
    body = (
      <EmptyState
        icon={MagnifyingGlassIcon}
        title="Busca en iTunes"
        body="Escribe el artista o el título. Elige una canción para agregarla con su portada y su vista previa."
      />
    )
  } else if (search.isPending || (typing && !search.data)) {
    body = (
      <View style={styles.skeletons} accessible accessibilityLabel="Buscando en iTunes">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={56} height={56} radius={radius.sm} />
            <View style={styles.skeletonTexts}>
              <Skeleton width="70%" height={space.lg} />
              <Skeleton width="45%" height={space.md} />
            </View>
          </View>
        ))}
      </View>
    )
  } else if (search.isError) {
    body = (
      <ErrorState
        title="La búsqueda falló"
        message={userMessage(search.error)}
        onRetry={() => void search.refetch()}
        retrying={search.isRefetching}
      />
    )
  } else {
    body = (
      <FlatList
        data={search.data}
        keyExtractor={(item) => String(item.iTunesTrackId)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.results}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            inCatalog={inCatalog.has(item.iTunesTrackId)}
            playing={preview.playingId === String(item.iTunesTrackId)}
            loading={preview.loadingId === String(item.iTunesTrackId)}
            onPreview={() => item.previewUrl && preview.toggle(String(item.iTunesTrackId), item.previewUrl)}
            onSelect={() => {
              create.reset()
              setSelected(item)
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={MusicNotesIcon}
            title="Sin resultados"
            body={`No encontramos canciones para “${debounced.trim()}”. Prueba solo con el nombre del artista.`}
          />
        }
        ListFooterComponent={
          search.data?.length ? (
            <View style={styles.attribution}>
              <ITunesAttribution />
            </View>
          ) : null
        }
      />
    )
  }

  return (
    <Screen edges={[]} padded={false}>
      <Stack.Screen options={{ title: 'Agregar canción' }} />
      <View style={styles.searchBox}>
        <TextField
          label="Buscar en iTunes"
          placeholder="Artista o canción"
          value={term}
          onChangeText={setTerm}
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          maxLength={100}
          clearButtonMode="while-editing"
        />
      </View>
      <View style={styles.body}>{body}</View>
      <AddSongSheet
        track={selected}
        create={create}
        playing={selected ? preview.playingId === String(selected.iTunesTrackId) : false}
        loading={selected ? preview.loadingId === String(selected.iTunesTrackId) : false}
        onPreview={() => selected?.previewUrl && preview.toggle(String(selected.iTunesTrackId), selected.previewUrl)}
        onClose={() => {
          preview.stop()
          setSelected(null)
        }}
      />
    </Screen>
  )
}

type TrackRowProps = {
  track: ITunesTrack
  inCatalog: boolean
  playing: boolean
  loading: boolean
  onPreview: () => void
  onSelect: () => void
}

function TrackRow({ track, inCatalog, playing, loading, onPreview, onSelect }: TrackRowProps) {
  const styles = useStyles(makeStyles)
  const meta = [track.primaryGenre, track.previewUrl ? null : 'Sin vista previa'].filter(Boolean).join(' · ')
  return (
    <View style={styles.trackRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${track.title}, de ${track.artist}${inCatalog ? '. Ya está en el catálogo' : ''}`}
        accessibilityHint={inCatalog ? undefined : 'Elige el género y agrégala al catálogo'}
        accessibilityState={{ disabled: inCatalog }}
        disabled={inCatalog}
        onPress={onSelect}
        style={({ pressed }) => [styles.trackMain, pressed && !inCatalog ? styles.pressed : null]}
      >
        <Cover uri={track.coverUrl} size={56} />
        <View style={styles.trackTexts}>
          <Text variant="headline" numberOfLines={2}>
            {track.title}
          </Text>
          <Text variant="footnote" color="textMuted" numberOfLines={1}>
            {track.artist}
          </Text>
          {inCatalog ? (
            <StatusTag label="Ya está en el catálogo" tone="done" />
          ) : meta ? (
            <Text variant="caption" color="textSubtle" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {track.previewUrl ? <PreviewButton title={track.title} playing={playing} loading={loading} onPress={onPreview} /> : null}
    </View>
  )
}

type AddSongSheetProps = {
  track: ITunesTrack | null
  create: ReturnType<typeof useCreateSong>
  playing: boolean
  loading: boolean
  onPreview: () => void
  onClose: () => void
}

function AddSongSheet({ track, create, onClose, ...rest }: AddSongSheetProps) {
  const close = () => {
    if (!create.isPending) onClose()
  }
  return (
    <Sheet visible={track !== null} onClose={close} title="Agregar al catálogo">
      {/* La key reinicia la elección de género al abrir otra canción. */}
      {track ? <AddSongBody key={track.iTunesTrackId} track={track} create={create} onClose={onClose} onCancel={close} {...rest} /> : null}
    </Sheet>
  )
}

type AddSongBodyProps = Omit<AddSongSheetProps, 'track'> & { track: ITunesTrack; onCancel: () => void }

function AddSongBody({ track, create, playing, loading, onPreview, onClose, onCancel }: AddSongBodyProps) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { genres } = useGenreLookup()
  const [picked, setPicked] = useState<string | null>(null)
  // Sugerencia de iTunes mientras no se elija otra; se calcula en el render porque los géneros pueden llegar después.
  const genre = picked ?? guessGenre(track.primaryGenre, genres)

  return (
    <>
      <View style={styles.sheetTrack}>
        <Cover uri={track.coverUrl} size={96} />
        <View style={styles.trackTexts}>
          <Text variant="headline" numberOfLines={3}>
            {track.title}
          </Text>
          <Text variant="footnote" color="textMuted" numberOfLines={2}>
            {track.artist}
          </Text>
          {track.previewUrl ? (
            <PreviewButton title={track.title} playing={playing} loading={loading} onPress={onPreview} />
          ) : (
            <Text variant="footnote" color="danger">
              Sin vista previa: en Descubrir no se podrá escuchar.
            </Text>
          )}
        </View>
      </View>

      <Text variant="callout" color="textMuted" accessibilityRole="header">
        Género en Encorely
      </Text>
      {genres?.length ? (
        <ScrollView style={styles.genres} contentContainerStyle={styles.chips} nestedScrollEnabled>
          {genres.map((g) => (
            <Chip key={g.slug} label={g.name} selected={genre === g.slug} onPress={() => setPicked(g.slug)} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="footnote" color="textMuted">
          Cargando géneros…
        </Text>
      )}
      {track.primaryGenre ? (
        <Text variant="footnote" color="textSubtle">
          En iTunes figura como {track.primaryGenre}.{genre ? ` Va a quedar en ${genreName(genre, genres)}.` : ''}
        </Text>
      ) : null}

      {create.error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {userMessage(create.error)}
        </Text>
      ) : null}

      <View style={styles.sheetActions}>
        <Button
          label="Agregar al catálogo"
          disabled={!genre}
          loading={create.isPending}
          onPress={() => {
            if (!genre) return
            create.mutate(trackToRequest(track, genre), {
              onSuccess: (song) => {
                toast.show(`Agregaste ${song.title} al catálogo.`, 'success')
                onClose()
              },
            })
          }}
        />
        <Button label="Cancelar" variant="ghost" onPress={onCancel} disabled={create.isPending} />
      </View>
      <ITunesAttribution />
    </>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    searchBox: { paddingHorizontal: space.gutter, paddingTop: space.lg, paddingBottom: space.md },
    body: { flex: 1 },
    results: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, flexGrow: 1 },
    skeletons: { gap: space.lg, paddingHorizontal: space.gutter, paddingTop: space.md },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    skeletonTexts: { flex: 1, gap: space.sm },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.border },
    trackRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    trackMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      borderRadius: radius.sm,
    },
    pressed: { backgroundColor: t.surface2 },
    trackTexts: { flex: 1, gap: 2 },
    attribution: { paddingTop: space.lg },
    sheetTrack: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
    genres: { maxHeight: 220 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    sheetActions: { gap: space.sm },
  })
