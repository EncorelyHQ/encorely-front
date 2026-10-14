import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { userMessage } from '@/lib/api/errors'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  FlagIcon,
  LoadingState,
  radius,
  Screen,
  space,
  Text,
  TextField,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { AdminGate, AdminQueryError } from '../components/AdminGate'
import { EvidenceCard } from '../components/EvidenceCard'
import { StatusTag } from '../components/StatusTag'
import { useAdminReport, useResolveReport, useSetUserStatus } from '../hooks/queries'
import { bogotaLabel } from '../model/datetime'
import {
  accountStatusLabel,
  ACTION_SUCCESS,
  priorReportsLabel,
  reasonLabel,
  REPORT_STATUS_LABEL,
  reportStatusTone,
} from '../model/reports'
import type { AdminReport, AdminUserRef, ReportAction, ReportStatus, UserStatus } from '../types'

const NOTE_MAX = 1000

export function AdminReportDetailScreen({ reportId, statusHint }: { reportId: string; statusHint?: ReportStatus }) {
  return (
    <AdminGate title="Reporte">
      <ReportDetail reportId={reportId} statusHint={statusHint} />
    </AdminGate>
  )
}

function ReportDetail({ reportId, statusHint }: { reportId: string; statusHint?: ReportStatus }) {
  const query = useAdminReport(reportId, statusHint)
  const header = <Stack.Screen options={{ title: 'Reporte' }} />

  if (query.report) return <ReportView report={query.report} />
  if (query.isPending) {
    return (
      <Screen edges={[]}>
        {header}
        <LoadingState label="Cargando reporte" />
      </Screen>
    )
  }
  if (query.error) {
    return (
      <Screen edges={[]}>
        {header}
        <AdminQueryError
          title="No pudimos cargar el reporte"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </Screen>
    )
  }
  return (
    <Screen edges={[]}>
      {header}
      <EmptyState
        icon={FlagIcon}
        title="No encontramos este reporte"
        body="Puede que ya no esté en la lista. Vuelve y búscalo de nuevo."
        action={{ label: 'Volver a reportes', onPress: () => router.back() }}
      />
    </Screen>
  )
}

type PendingConfirm = { kind: 'ban' } | { kind: 'status'; status: UserStatus } | null

function ReportView({ report }: { report: AdminReport }) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const resolve = useResolveReport()
  const setStatus = useSetUserStatus()
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<PendingConfirm>(null)
  const open = report.status === 'open'
  const reported = report.reported
  const busy = resolve.isPending || setStatus.isPending
  const pendingAction = resolve.isPending ? resolve.variables?.action : undefined

  const runResolve = (action: ReportAction) => {
    resolve.mutate(
      { reportId: report.id, action, note },
      {
        onSuccess: () => {
          setConfirm(null)
          toast.show(ACTION_SUCCESS[action], 'success')
          router.back()
        },
      },
    )
  }

  const runStatus = (status: UserStatus) => {
    if (!reported) return
    setStatus.mutate(
      { userId: reported.id, status },
      {
        onSuccess: () => {
          setConfirm(null)
          toast.show(status === 'banned' ? 'Cuenta suspendida.' : 'Cuenta reactivada.', 'success')
        },
      },
    )
  }

  const prior = priorReportsLabel(report.priorReportsAgainstUser)
  const confirmError = confirm?.kind === 'ban' ? resolve.error : confirm?.kind === 'status' ? setStatus.error : null
  const reportedName = reported?.displayName ?? 'esta cuenta'

  return (
    <Screen
      edges={[]}
      mode={open ? 'form' : 'scroll'}
      contentStyle={styles.content}
      footer={
        open ? (
          <>
            {resolve.error && confirm === null ? (
              <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
                {userMessage(resolve.error)}
              </Text>
            ) : null}
            <View style={styles.actionRow}>
              <View style={styles.actionCell}>
                <Button
                  label="Descartar"
                  variant="secondary"
                  loading={pendingAction === 'dismiss'}
                  disabled={busy}
                  onPress={() => runResolve('dismiss')}
                  accessibilityHint="Cierra el reporte sin sanción, por no tener mérito"
                />
              </View>
              <View style={styles.actionCell}>
                <Button
                  label="Resolver"
                  loading={pendingAction === 'resolve'}
                  disabled={busy}
                  onPress={() => runResolve('resolve')}
                  accessibilityHint="Cierra el reporte como atendido, sin suspender la cuenta"
                />
              </View>
            </View>
            {reported && reported.status === 'active' ? (
              <Button
                label="Suspender cuenta"
                variant="destructive"
                disabled={busy}
                onPress={() => {
                  resolve.reset()
                  setConfirm({ kind: 'ban' })
                }}
              />
            ) : null}
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Reporte' }} />

      <View style={styles.block}>
        <Text variant="title2" accessibilityRole="header">
          {reasonLabel(report.reason)}
        </Text>
        <StatusTag label={REPORT_STATUS_LABEL[report.status]} tone={reportStatusTone(report.status)} />
        <Text variant="footnote" color="textMuted">
          Reportado el <Text variant="data" color="textMuted">{bogotaLabel(report.createdAt)}</Text>
        </Text>
      </View>

      {report.detail ? (
        <Section title="Lo que contó quien reporta">
          <View style={styles.card}>
            <Text variant="body" selectable>
              {report.detail}
            </Text>
          </View>
        </Section>
      ) : null}

      <Section title="Cuenta reportada">
        {reported ? (
          <View style={styles.card}>
            <Person person={reported} />
            {prior ? (
              <Text variant="footnote" color="danger">
                {prior}
              </Text>
            ) : null}
            {reported.status === 'banned' ? (
              <Button
                label="Reactivar cuenta"
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setStatus.reset()
                  setConfirm({ kind: 'status', status: 'active' })
                }}
              />
            ) : !open ? (
              <Button
                label="Suspender cuenta"
                variant="destructive"
                disabled={busy}
                onPress={() => {
                  setStatus.reset()
                  setConfirm({ kind: 'status', status: 'banned' })
                }}
              />
            ) : null}
          </View>
        ) : (
          <Text variant="body" color="textMuted">
            La cuenta ya no existe. Solo puedes descartar o resolver el reporte.
          </Text>
        )}
      </Section>

      <Section title="Quién reporta">
        {report.reporter ? (
          <View style={styles.card}>
            <Person person={report.reporter} />
          </View>
        ) : (
          <Text variant="body" color="textMuted">
            La cuenta que reportó ya no existe.
          </Text>
        )}
      </Section>

      <Section
        title={report.evidence.length ? `Evidencia (${report.evidence.length})` : 'Evidencia'}
        footer={
          report.evidence.length
            ? 'Verificado quiere decir que el servidor comprobó la firma del mensaje: lo envió esa cuenta y nadie lo cambió.'
            : undefined
        }
      >
        {report.evidence.length ? (
          report.evidence.map((ev, index) => (
            <EvidenceCard key={ev.messageId} evidence={ev} index={index} reportedUserId={reported?.id ?? null} />
          ))
        ) : (
          <Text variant="body" color="textMuted">
            No adjuntó mensajes.
          </Text>
        )}
      </Section>

      {open ? (
        <TextField
          label="Nota de resolución (opcional)"
          helper="Queda guardada con el reporte. La persona reportada no la ve."
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
          maxLength={NOTE_MAX}
          style={styles.note}
        />
      ) : (
        <Section title="Resolución">
          <View style={styles.card}>
            <Text variant="body">{REPORT_STATUS_LABEL[report.status]}</Text>
            {report.resolvedAt ? (
              <Text variant="footnote" color="textMuted">
                El <Text variant="data" color="textMuted">{bogotaLabel(report.resolvedAt)}</Text>
              </Text>
            ) : null}
            <Text variant="body" color={report.resolutionNote ? 'text' : 'textMuted'} selectable>
              {report.resolutionNote ?? 'Sin nota.'}
            </Text>
          </View>
        </Section>
      )}

      <ConfirmSheet
        visible={confirm !== null}
        title={
          confirm?.kind === 'status' && confirm.status === 'active'
            ? `¿Reactivar a ${reportedName}?`
            : `¿Suspender a ${reportedName}?`
        }
        message={
          confirm?.kind === 'status' && confirm.status === 'active'
            ? 'Podrá volver a entrar. Los matches que se cerraron con la suspensión no se reabren.'
            : 'Se cierran todos sus matches activos y se revocan sus sesiones en todos sus dispositivos: no podrá volver a entrar.' +
              (confirm?.kind === 'ban' ? ' El reporte queda resuelto.' : '') +
              ' Puedes reactivarla después, pero los matches no vuelven.'
        }
        confirmLabel={confirm?.kind === 'status' && confirm.status === 'active' ? 'Reactivar cuenta' : 'Suspender cuenta'}
        destructive={!(confirm?.kind === 'status' && confirm.status === 'active')}
        loading={busy}
        onConfirm={() => {
          if (confirm?.kind === 'ban') runResolve('ban')
          else if (confirm?.kind === 'status') runStatus(confirm.status)
        }}
        onCancel={() => {
          if (!busy) setConfirm(null)
        }}
      >
        {confirmError ? (
          <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
            {userMessage(confirmError)}
          </Text>
        ) : null}
      </ConfirmSheet>
    </Screen>
  )
}

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.section}>
      <Text variant="caption" color="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Text>
      {children}
      {footer ? (
        <Text variant="footnote" color="textSubtle">
          {footer}
        </Text>
      ) : null}
    </View>
  )
}

function Person({ person }: { person: AdminUserRef }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.person}>
      <View style={styles.personTop}>
        <Text variant="headline" style={styles.flex}>
          {person.displayName}
        </Text>
        <StatusTag label={accountStatusLabel(person.status)} tone={person.status === 'banned' ? 'danger' : 'neutral'} />
      </View>
      <Text variant="footnote" color="textMuted" selectable>
        {person.email}
      </Text>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    content: { gap: space.xl, paddingBottom: space.xxl },
    block: { gap: space.sm },
    section: { gap: space.sm },
    sectionTitle: { paddingHorizontal: space.xs, letterSpacing: 0.6 },
    card: { gap: space.md, padding: space.lg, borderRadius: radius.sm + 4, backgroundColor: t.surface },
    person: { gap: space.xs },
    personTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
    flex: { flexShrink: 1 },
    note: { minHeight: 96 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    actionCell: { flexGrow: 1, flexBasis: 140 },
  })
