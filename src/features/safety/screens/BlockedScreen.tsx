import { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { safetyApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import type { BlockedUser } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import {
  Avatar,
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  ProhibitIcon,
  radius,
  Screen,
  Skeleton,
  space,
  Text,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { formatShortDate } from '../format'

export function BlockedScreen() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<BlockedUser | null>(null)

  const blocks = useQuery({ queryKey: queryKeys.blocks, queryFn: safetyApi.blocks })

  const unblock = useMutation({
    mutationFn: (userId: string) => safetyApi.unblock(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<BlockedUser[]>(queryKeys.blocks, (prev) => prev?.filter((b) => b.userId !== userId))
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocks })
      toast.show(`Desbloqueaste a ${target?.displayName ?? 'esta persona'}.`, 'success')
      setTarget(null)
    },
  })

  const header = <Stack.Screen options={{ title: 'Personas bloqueadas' }} />

  if (blocks.isPending) {
    return (
      <Screen edges={[]}>
        {header}
        <View style={styles.skeletons} accessibilityLabel="Cargando personas bloqueadas" accessible>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} radius={radius.full} />
              <View style={styles.skeletonTexts}>
                <Skeleton width="50%" height={space.lg} />
                <Skeleton width="30%" height={space.md} />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    )
  }

  if (blocks.isError) {
    return (
      <Screen edges={[]}>
        {header}
        <ErrorState
          title="No pudimos cargar la lista"
          message={userMessage(blocks.error)}
          onRetry={() => void blocks.refetch()}
          retrying={blocks.isRefetching}
        />
      </Screen>
    )
  }

  return (
    <Screen edges={[]} padded={false}>
      {header}
      <FlatList
        data={blocks.data}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={blocks.data.length === 0 ? styles.emptyContainer : styles.list}
        refreshing={blocks.isRefetching}
        onRefresh={() => void blocks.refetch()}
        ListHeaderComponent={
          blocks.data.length > 0 ? (
            <Text variant="footnote" color="textMuted" style={styles.intro}>
              No pueden escribirte ni verte en el radar. Desbloquear no recupera el match.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={ProhibitIcon}
            title="No has bloqueado a nadie."
            body="Si alguien te incomoda, puedes bloquearlo desde su chat."
          />
        }
        renderItem={({ item, index }) => (
          <BlockedRow
            item={item}
            first={index === 0}
            last={index === blocks.data.length - 1}
            onUnblock={() => {
              unblock.reset()
              setTarget(item)
            }}
          />
        )}
      />
      <ConfirmSheet
        visible={target !== null}
        title={`¿Desbloquear a ${target?.displayName ?? ''}?`}
        message="Podrá volver a verte en el radar si van al mismo concierto. El match anterior no se recupera."
        confirmLabel="Desbloquear"
        loading={unblock.isPending}
        onConfirm={() => target && unblock.mutate(target.userId)}
        onCancel={() => {
          if (!unblock.isPending) setTarget(null)
        }}
      >
        {unblock.error ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {userMessage(unblock.error)}
          </Text>
        ) : null}
      </ConfirmSheet>
    </Screen>
  )
}

function BlockedRow({
  item,
  first,
  last,
  onUnblock,
}: {
  item: BlockedUser
  first: boolean
  last: boolean
  onUnblock: () => void
}) {
  const styles = useStyles(makeStyles)
  const date = formatShortDate(item.createdAt)
  return (
    <View style={[styles.row, first ? styles.rowFirst : null, last ? styles.rowLast : styles.rowDivider]}>
      <Avatar name={item.displayName} size={AVATAR_SIZE} />
      <View style={styles.texts}>
        <Text variant="body" numberOfLines={2}>
          {item.displayName}
        </Text>
        {date ? (
          <Text variant="footnote" color="textMuted">
            Bloqueado el <Text variant="data" color="textMuted">{date}</Text>
          </Text>
        ) : null}
      </View>
      <Button
        label="Desbloquear"
        variant="secondary"
        fullWidth={false}
        onPress={onUnblock}
        accessibilityLabel={`Desbloquear a ${item.displayName}`}
      />
    </View>
  )
}

const AVATAR_SIZE = 40
const GROUP_RADIUS = space.md

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    list: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
    emptyContainer: { flexGrow: 1 },
    intro: { paddingHorizontal: space.xs, marginBottom: space.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: t.surface,
    },
    rowFirst: { borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS },
    rowLast: { borderBottomLeftRadius: GROUP_RADIUS, borderBottomRightRadius: GROUP_RADIUS },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
    texts: { flex: 1, minWidth: '40%', gap: 2 },
    skeletons: { gap: space.lg, paddingTop: space.sm },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    skeletonTexts: { flex: 1, gap: space.sm },
  })
