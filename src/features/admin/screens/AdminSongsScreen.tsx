import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { genreName, useGenreLookup } from '@/features/events/genres'
import { userMessage } from '@/lib/api/errors'
import {
  Button,
  EmptyState,
  ListRow,
  MusicNotesIcon,
  radius,
  Screen,
  SegmentedTabs,
  Skeleton,
  space,
  Text,
  TextField,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { AdminGate, AdminQueryError } from '../components/AdminGate'
import { Cover } from '../components/Cover'
import { useAdminSongs, useLoadMoreSongs, useUpdateSong } from '../hooks/queries'
import { PlusIcon } from '../icons'
import { canLoadMoreSongs, filterSongs, pageMayContinue, songToRequest } from '../model/songs'
import type { AdminSong } from '../types'

export function AdminSongsScreen() {
  return (
    <AdminGate title="Canciones">
      <AdminSongs />
    </AdminGate>
  )
}

type Filter = 'all' | 'active' | 'inactive'

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'En el feed' },
  { value: 'inactive', label: 'Fuera del feed' },
] as const

function AdminSongs() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const songs = useAdminSongs()
  const loadMore = useLoadMoreSongs()
  // Total en el que una página llegó incompleta. Un refetch vuelve a la primera página y cambia el total, así que no se pega.
  const [endAt, setEndAt] = useState<number | null>(null)
  const loaded = songs.data?.length ?? 0
  const canLoadMore = canLoadMoreSongs(loaded, endAt)
  const update = useUpdateSong()
  const { genres } = useGenreLookup()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    const byText = filterSongs(songs.data ?? [], query)
    if (filter === 'all') return byText
    return byText.filter((s) => s.isActive === (filter === 'active'))
  }, [songs.data, query, filter])

  const header = <Stack.Screen options={{ title: 'Canciones' }} />
  const footer = <Button label="Agregar canción" icon={PlusIcon} onPress={() => router.push('/admin/songs/new')} />

  const toggle = (song: AdminSong, isActive: boolean) => {
    update.mutate(
      { id: song.id, body: songToRequest(song, { isActive }) },
      {
        onSuccess: () => toast.show(isActive ? `${song.title} vuelve al feed.` : `${song.title} salió del feed.`, 'success'),
        onError: (error) => toast.show(userMessage(error), 'danger'),
      },
    )
  }

  if (songs.isPending) {
    return (
      <Screen edges={[]} footer={footer}>
        {header}
        <View style={styles.skeletons} accessible accessibilityLabel="Cargando canciones">
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={48} height={48} radius={radius.sm} />
              <View style={styles.skeletonTexts}>
                <Skeleton width="60%" height={space.lg} />
                <Skeleton width="40%" height={space.md} />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    )
  }

  if (songs.isError) {
    return (
      <Screen edges={[]}>
        {header}
        <AdminQueryError
          title="No pudimos cargar las canciones"
          error={songs.error}
          onRetry={() => void songs.refetch()}
          retrying={songs.isRefetching}
        />
      </Screen>
    )
  }

  const total = songs.data.length
  const active = songs.data.filter((s) => s.isActive).length

  return (
    <Screen edges={[]} padded={false} footer={footer}>
      {header}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        refreshing={songs.isRefetching}
        onRefresh={() => void songs.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              label="Buscar en el catálogo"
              placeholder="Título o artista"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <SegmentedTabs segments={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Filtrar canciones" />
            <Text variant="footnote" color="textMuted">
              <Text variant="data" color="textMuted">{active}</Text> de{' '}
              <Text variant="data" color="textMuted">{total}</Text> en el feed. Desactivar una canción la saca de Descubrir sin
              borrar lo que ya calificaron.
            </Text>
            {canLoadMore ? (
              <Text variant="footnote" color="textSubtle">
                La búsqueda solo ve las canciones cargadas. Si no ves una, carga más al final de la lista.
              </Text>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.rowWrap,
              index === 0 ? styles.rowFirst : null,
              index === visible.length - 1 ? styles.rowLast : null,
            ]}
          >
            <ListRow
              title={item.title}
              subtitle={`${item.artist} · ${genreName(item.genre, genres)}`}
              leading={<Cover uri={item.coverUrl} size={48} />}
              switchValue={item.isActive}
              onSwitchChange={(value) => toggle(item, value)}
              onPress={() => router.push({ pathname: '/admin/songs/[id]', params: { id: item.id } })}
              accessibilityHint={item.isActive ? 'Está en el feed. Toca para editar.' : 'Fuera del feed. Toca para editar.'}
            />
          </View>
        )}
        ListFooterComponent={
          canLoadMore ? (
            <View style={styles.more}>
              <Button
                label="Cargar más canciones"
                variant="secondary"
                loading={loadMore.isPending}
                onPress={() =>
                  loadMore.mutate(total, {
                    onSuccess: (page) => {
                      if (!pageMayContinue(page.length)) setEndAt(total + page.length)
                    },
                    onError: (error) => toast.show(userMessage(error), 'danger'),
                  })
                }
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          total === 0 ? (
            <EmptyState
              icon={MusicNotesIcon}
              title="El catálogo está vacío"
              body="Agrega canciones desde iTunes para que la gente pueda calificarlas en Descubrir."
            />
          ) : (
            <EmptyState
              icon={MusicNotesIcon}
              title="Ninguna canción coincide"
              body={query ? `No hay resultados para “${query.trim()}” con este filtro.` : 'Prueba con otro filtro.'}
              action={{
                label: 'Limpiar búsqueda',
                onPress: () => {
                  setQuery('')
                  setFilter('all')
                },
              }}
            />
          )
        }
      />
    </Screen>
  )
}

const GROUP_RADIUS = space.md

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, flexGrow: 1 },
    header: { gap: space.md, paddingTop: space.lg, paddingBottom: space.lg },
    skeletons: { gap: space.lg, paddingTop: space.xl },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    skeletonTexts: { flex: 1, gap: space.sm },
    rowWrap: { overflow: 'hidden' },
    rowFirst: { borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS },
    rowLast: { borderBottomLeftRadius: GROUP_RADIUS, borderBottomRightRadius: GROUP_RADIUS },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.border },
    more: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
  })
