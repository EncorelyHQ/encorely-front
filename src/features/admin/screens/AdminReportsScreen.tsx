import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import {
  CheckCircleIcon,
  EmptyState,
  FlagIcon,
  radius,
  Screen,
  SegmentedTabs,
  Skeleton,
  space,
  Text,
  useStyles,
  type Theme,
} from '@/ui'
import { AdminGate, AdminQueryError } from '../components/AdminGate'
import { StatusTag } from '../components/StatusTag'
import { useAdminReports } from '../hooks/queries'
import { bogotaLabel } from '../model/datetime'
import {
  pendingCountLabel,
  reasonLabel,
  REPORT_STATUS_LABEL,
  reportStatusTone,
  type ReportTab,
} from '../model/reports'
import type { AdminReport } from '../types'

export function AdminReportsScreen() {
  return (
    <AdminGate title="Reportes">
      <AdminReports />
    </AdminGate>
  )
}

function AdminReports() {
  const styles = useStyles(makeStyles)
  const [tab, setTab] = useState<ReportTab>('pending')
  const reports = useAdminReports(tab)
  const header = <Stack.Screen options={{ title: 'Reportes' }} />

  const segments = [
    { value: 'pending', label: tab === 'pending' && !reports.isPending ? `Pendientes (${pendingCountLabel(reports.data.length)})` : 'Pendientes' },
    { value: 'closed', label: 'Resueltos' },
  ] as const

  const tabs = (
    <View style={styles.tabs}>
      <SegmentedTabs segments={segments} value={tab} onChange={setTab} accessibilityLabel="Estado de los reportes" />
    </View>
  )

  if (reports.isPending) {
    return (
      <Screen edges={[]} padded={false}>
        {header}
        {tabs}
        <View style={styles.skeletons} accessible accessibilityLabel="Cargando reportes">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={96} radius={radius.sm + 4} />
          ))}
        </View>
      </Screen>
    )
  }

  if (reports.isError) {
    return (
      <Screen edges={[]} padded={false}>
        {header}
        {tabs}
        <AdminQueryError
          title="No pudimos cargar los reportes"
          error={reports.error}
          onRetry={() => void reports.refetch()}
          retrying={reports.isRefetching}
        />
      </Screen>
    )
  }

  return (
    <Screen edges={[]} padded={false}>
      {header}
      <FlatList
        data={reports.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={reports.isRefetching}
        onRefresh={() => void reports.refetch()}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SegmentedTabs segments={segments} value={tab} onChange={setTab} accessibilityLabel="Estado de los reportes" />
            {tab === 'pending' && reports.data.length > 0 ? (
              <Text variant="footnote" color="textMuted">
                Del más antiguo al más reciente: atiende primero los que llevan más tiempo esperando.
              </Text>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        renderItem={({ item }) => (
          <ReportRow
            report={item}
            showStatus={tab === 'closed'}
            onPress={() => router.push({ pathname: '/admin/reports/[id]', params: { id: item.id, status: item.status } })}
          />
        )}
        ListEmptyComponent={
          tab === 'pending' ? (
            <EmptyState
              icon={CheckCircleIcon}
              title="No hay reportes pendientes"
              body="Cuando alguien reporte una cuenta, aparece aquí."
            />
          ) : (
            <EmptyState icon={FlagIcon} title="Aún no hay reportes resueltos" body="Los que atiendas quedan aquí con su nota." />
          )
        }
      />
    </Screen>
  )
}

function ReportRow({ report, showStatus, onPress }: { report: AdminReport; showStatus: boolean; onPress: () => void }) {
  const styles = useStyles(makeStyles)
  const reported = report.reported?.displayName ?? 'Cuenta eliminada'
  const reason = reasonLabel(report.reason)
  const evidence =
    report.evidence.length === 0 ? null : report.evidence.length === 1 ? '1 mensaje de evidencia' : `${report.evidence.length} mensajes de evidencia`
  const prior = report.priorReportsAgainstUser
  const when = bogotaLabel(report.createdAt)
  const label = [
    `${reason}. Contra ${reported}`,
    showStatus ? REPORT_STATUS_LABEL[report.status] : null,
    `Reportado el ${when}`,
    evidence,
    prior > 0 ? `${prior} reportes anteriores` : null,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre el reporte"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowTop}>
        <Text variant="headline" style={styles.flex} numberOfLines={2}>
          {reason}
        </Text>
        {showStatus ? <StatusTag label={REPORT_STATUS_LABEL[report.status]} tone={reportStatusTone(report.status)} /> : null}
      </View>
      <Text variant="body" numberOfLines={1}>
        Contra {reported}
      </Text>
      {report.detail ? (
        <Text variant="footnote" color="textMuted" numberOfLines={2}>
          {report.detail}
        </Text>
      ) : null}
      <View style={styles.meta}>
        <Text variant="data" color="textSubtle">
          {when}
        </Text>
        {evidence ? (
          <Text variant="caption" color="textMuted">
            {evidence}
          </Text>
        ) : null}
        {prior > 0 ? (
          <Text variant="caption" color="danger">
            {prior === 1 ? '1 reporte anterior' : `${prior} reportes anteriores`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    tabs: { paddingHorizontal: space.gutter, paddingTop: space.lg },
    skeletons: { gap: space.sm, paddingHorizontal: space.gutter, paddingTop: space.lg },
    list: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, flexGrow: 1 },
    listHeader: { gap: space.md, paddingTop: space.lg, paddingBottom: space.lg },
    gap: { height: space.sm },
    row: {
      gap: space.xs,
      padding: space.lg,
      borderRadius: radius.sm + 4,
      backgroundColor: t.surface,
    },
    // Tarjeta suelta (no fila de lista): además del fondo, cede un poco bajo el dedo.
    pressed: { backgroundColor: t.surface2, transform: [{ scale: 0.98 }] },
    rowTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm },
    flex: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xs, marginTop: space.xs },
  })
