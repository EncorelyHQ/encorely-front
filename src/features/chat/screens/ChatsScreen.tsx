import { useCallback, useState, type ReactElement } from 'react'
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useGenreLookup } from '@/features/events/genres'
import { PushPrimer } from '@/features/push'
import { userMessage } from '@/lib/api/errors'
import type { MatchSummary } from '@/lib/api/types'
import { ChatsCircleIcon, EmptyState, ErrorState, radius, Skeleton, space, Text, useStyles, useTheme, type Theme } from '@/ui'
import { ChatRow, NewMatchesStrip, RowSeparator } from '../components/ChatListItems'
import { matchReason } from '../data/matchCopy'
import { useMatchesList } from '../hooks/useMatchesList'
import { useNow } from '../hooks/useNow'

export function ChatsScreen() {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const list = useMatchesList()
  const { sentence } = useGenreLookup()
  const [pulling, setPulling] = useState(false)
  const [primerShown, setPrimerShown] = useState(false)
  const now = useNow()

  const reasonFor = useCallback((match: MatchSummary) => matchReason(match, sentence), [sentence])
  const open = useCallback(
    (match: MatchSummary) => router.push({ pathname: '/chat/[matchId]', params: { matchId: match.id } }),
    [],
  )

  const onRefresh = useCallback(async () => {
    setPulling(true)
    try {
      await list.refetch()
    } finally {
      setPulling(false)
    }
  }, [list])

  const renderItem: ListRenderItem<MatchSummary> = useCallback(
    ({ item }) => <ChatRow match={item} reason={reasonFor(item)} now={now} onPress={open} />,
    [now, open, reasonFor],
  )

  const header = (
    <View style={styles.header}>
      <View style={styles.gutter}>
        <Text variant="title1" accessibilityRole="header">
          Chats
        </Text>
        {/* PushPrimer decide solo si se muestra: el espacio arriba solo existe cuando ocupa algo. */}
        <View style={primerShown ? styles.primer : null}>
          <View onLayout={(e) => setPrimerShown(e.nativeEvent.layout.height > 0)}>
            <PushPrimer />
          </View>
        </View>
      </View>
      {list.fresh.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Nuevos</SectionLabel>
          <NewMatchesStrip matches={list.fresh} reasonFor={reasonFor} onPress={open} />
        </View>
      ) : null}
      {/* Con una sola sección el rótulo sobra: solo distingue cuando también hay matches nuevos. */}
      {list.conversations.length > 0 && list.fresh.length > 0 ? <SectionLabel>Conversaciones</SectionLabel> : null}
    </View>
  )

  let body: ReactElement | null = null
  if (list.isPending) body = <ListSkeleton />
  else if (list.isError && !list.data) {
    body = (
      <ErrorState
        title="No pudimos cargar tus chats"
        message={userMessage(list.error)}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (list.fresh.length === 0 && list.conversations.length === 0) {
    body = (
      <EmptyState
        icon={ChatsCircleIcon}
        title="Todavía no tienes matches"
        body="Marca que vas a un concierto y mira quién más va."
        action={{ label: 'Ver conciertos', onPress: () => router.push('/events') }}
      />
    )
  } else if (list.conversations.length === 0) {
    body = (
      <Text variant="callout" color="textMuted" style={[styles.gutter, styles.hint]}>
        Escríbele a alguno de tus matches nuevos. Los mensajes se cifran en tu teléfono.
      </Text>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={body ? [] : list.conversations}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        ItemSeparatorComponent={RowSeparator}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
            progressBackgroundColor={theme.surface}
          />
        }
      />
    </View>
  )
}

function SectionLabel({ children }: { children: string }) {
  const styles = useStyles(makeStyles)
  return (
    <Text variant="footnote" color="textMuted" accessibilityRole="header" style={styles.gutter}>
      {children}
    </Text>
  )
}

const AVATAR = 48

function ListSkeleton() {
  const styles = useStyles(makeStyles)
  return (
    <View accessible accessibilityLabel="Cargando chats" accessibilityRole="progressbar" style={styles.skeleton}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={AVATAR} height={AVATAR} radius={radius.full} />
          <View style={styles.skeletonTexts}>
            <Skeleton width="45%" height={space.lg} />
            <Skeleton width="80%" height={space.md} />
          </View>
        </View>
      ))}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    content: { flexGrow: 1, paddingBottom: space.xl },
    header: { paddingTop: space.lg, gap: space.lg, paddingBottom: space.sm },
    gutter: { paddingHorizontal: space.gutter },
    primer: { paddingTop: space.lg },
    section: { gap: space.sm },
    hint: { paddingTop: space.md },
    skeleton: { gap: space.lg, paddingHorizontal: space.gutter, paddingTop: space.sm },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    skeletonTexts: { flex: 1, gap: space.sm },
  })
