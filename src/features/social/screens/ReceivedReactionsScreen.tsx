import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { BlockReportSheet } from '@/features/safety'
import { userMessage } from '@/lib/api/errors'
import type { ReceivedReaction } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import {
  Avatar,
  Button,
  DotsThreeVerticalIcon,
  EmptyState,
  ErrorState,
  IconButton,
  Screen,
  Skeleton,
  Sticker,
  Text,
  radius,
  space,
  useStyles,
  type Theme,
} from '@/ui'
import { useReceivedReactions } from '../queries'
import { flattenReceived, reactedAtLabel } from '../received'
import { reactionLabel, reactionTone } from '../stickers'

const AVATAR = 48

// Quién reaccionó a tu perfil, con nombre (decisión del 2026-10-14). Desde cada fila se puede bloquear o reportar.
export function ReceivedReactionsScreen() {
  const styles = useStyles(makeStyles)
  const qc = useQueryClient()
  const received = useReceivedReactions()
  const items = useMemo(() => flattenReceived(received.data?.pages), [received.data])
  const [target, setTarget] = useState<ReceivedReaction | null>(null)
  const header = <Stack.Screen options={{ title: 'Reacciones' }} />

  if (received.isPending) {
    return (
      <Screen edges={[]}>
        {header}
        <View style={styles.skeletons} accessible accessibilityRole="progressbar" accessibilityLabel="Cargando reacciones">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={AVATAR} height={AVATAR} radius={radius.full} />
              <View style={styles.texts}>
                <Skeleton width="45%" height={space.lg} />
                <Skeleton width="70%" height={space.md} />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    )
  }

  // Si falla la página siguiente, TanStack pasa a error pero conserva las anteriores: solo se reemplaza la lista si no hay nada.
  if (received.isError && !received.data) {
    return (
      <Screen edges={[]}>
        {header}
        <ErrorState
          title="No pudimos cargar tus reacciones"
          message={userMessage(received.error)}
          onRetry={() => void received.refetch()}
          retrying={received.isRefetching}
        />
      </Screen>
    )
  }

  return (
    <Screen edges={[]} padded={false}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(r) => `${r.from.userId}|${r.targetKind}|${r.targetKey}`}
        contentContainerStyle={styles.list}
        refreshing={received.isRefetching && !received.isFetchingNextPage}
        onRefresh={() => void received.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (received.hasNextPage && !received.isFetchingNextPage) void received.fetchNextPage()
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <ReactionRow item={item} onMore={() => setTarget(item)} />}
        ListEmptyComponent={
          <EmptyState
            title="Todavía nadie te pegó un sticker"
            body="Cuando alguien reaccione a tus géneros o artistas, aparece aquí con su nombre."
          />
        }
        ListFooterComponent={
          received.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text variant="footnote" color="danger">
                {userMessage(received.error)}
              </Text>
              <Button label="Reintentar" variant="secondary" fullWidth={false} onPress={() => void received.fetchNextPage()} />
            </View>
          ) : received.isFetchingNextPage ? (
            <View style={styles.footer}>
              <Skeleton width="60%" height={space.lg} />
            </View>
          ) : null
        }
      />
      {target ? (
        <BlockReportSheet
          visible
          userId={target.from.userId}
          displayName={target.from.displayName}
          onClose={() => setTarget(null)}
          onDone={(outcome) => {
            setTarget(null)
            // Bloquear borra las reacciones del par: la lista y los conteos de /me cambian.
            if (outcome !== 'reported') {
              void qc.invalidateQueries({ queryKey: queryKeys.receivedReactions })
              void qc.invalidateQueries({ queryKey: queryKeys.me, exact: true })
            }
          }}
        />
      ) : null}
    </Screen>
  )
}

function ReactionRow({ item, onMore }: { item: ReceivedReaction; onMore: () => void }) {
  const styles = useStyles(makeStyles)
  const label = reactionLabel(item.reaction)
  const when = reactedAtLabel(item.reactedAt)
  return (
    <View style={styles.row}>
      <View
        style={styles.main}
        accessible
        accessibilityLabel={`${item.from.displayName} te pegó «${label}» en ${item.targetName}, ${when}`}
      >
        <Avatar name={item.from.displayName} size={AVATAR} />
        <View style={styles.texts}>
          <Text variant="headline" numberOfLines={2}>
            {item.from.displayName}
          </Text>
          <Text variant="footnote" color="textMuted">
            en {item.targetName} · {when}
          </Text>
          <Sticker label={label} tone={reactionTone(item.reaction)} size="tag" angle={-3} style={styles.sticker} />
        </View>
      </View>
      <IconButton icon={DotsThreeVerticalIcon} label={`Bloquear o reportar a ${item.from.displayName}`} onPress={onMore} />
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: space.gutter, paddingVertical: space.lg, flexGrow: 1 },
    skeletons: { gap: space.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
    texts: { flex: 1, gap: space.xs },
    sticker: { marginTop: space.xs },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.border },
    footer: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  })
