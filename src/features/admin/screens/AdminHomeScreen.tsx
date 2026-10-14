import { ActivityIndicator, StyleSheet } from 'react-native'
import { router, Stack } from 'expo-router'
import { FlagIcon, ListRow, ListSection, MusicNotesIcon, Screen, space, TicketIcon, useStyles, useTheme, type Theme } from '@/ui'
import { AdminGate } from '../components/AdminGate'
import { CountBadge } from '../components/StatusTag'
import { useAdminEvents, usePendingReportsCount } from '../hooks/queries'
import { pendingCountLabel } from '../model/reports'

export function AdminHomeScreen() {
  return (
    <AdminGate title="Administración">
      <AdminHome />
    </AdminGate>
  )
}

function upcomingLabel(count: number): string {
  if (count === 0) return 'No hay conciertos próximos'
  return count === 1 ? '1 concierto próximo' : `${count} conciertos próximos`
}

function AdminHome() {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const pending = usePendingReportsCount()
  const events = useAdminEvents()
  const upcoming = events.data?.filter((e) => Date.parse(e.startsAt) > events.dataUpdatedAt).length

  const pendingCount = pending.data ?? 0
  const pendingText = pending.isError
    ? 'No pudimos contar los pendientes'
    : pending.isPending
      ? 'Contando pendientes…'
      : pendingCount === 0
        ? 'Nada pendiente'
        : pendingCount === 1
          ? '1 pendiente por revisar'
          : `${pendingCountLabel(pendingCount)} pendientes por revisar`

  return (
    <Screen
      edges={[]}
      mode="scroll"
      refreshing={pending.isRefetching || events.isRefetching}
      onRefresh={() => {
        void pending.refetch()
        void events.refetch()
      }}
      contentStyle={styles.content}
    >
      <Stack.Screen options={{ title: 'Administración' }} />
      <ListSection title="Catálogo">
        <ListRow
          title="Conciertos"
          subtitle={upcoming === undefined ? 'Crear, editar y borrar' : upcomingLabel(upcoming)}
          icon={TicketIcon}
          onPress={() => router.push('/admin/events')}
        />
        <ListRow
          title="Canciones"
          subtitle="Agregar desde iTunes y sacar del feed"
          icon={MusicNotesIcon}
          onPress={() => router.push('/admin/songs')}
        />
      </ListSection>

      <ListSection title="Moderación" footer="Los reportes más antiguos aparecen primero.">
        <ListRow
          title="Reportes"
          subtitle={pendingText}
          icon={FlagIcon}
          trailing={
            pending.isPending ? (
              <ActivityIndicator color={theme.textMuted} />
            ) : pendingCount > 0 ? (
              <CountBadge count={pendingCountLabel(pendingCount)} label={pendingText} />
            ) : undefined
          }
          onPress={() => router.push('/admin/reports')}
        />
      </ListSection>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    content: { gap: space.xxl },
  })
