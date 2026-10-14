// Import directo del archivo (no del índice) para no arrastrar las pantallas de safety al panel.
import { REPORT_REASONS } from '@/features/safety/reportReasons'
import type { AdminReport, ReportAction, ReportReason, ReportStatus, UserStatus } from '../types'

export type ReportTab = 'pending' | 'closed'

// El back filtra por un solo estado: "Resueltos" junta resolved y dismissed en el cliente.
export const TAB_STATUSES: Record<ReportTab, readonly ReportStatus[]> = {
  pending: ['open'],
  closed: ['resolved', 'dismissed'],
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Pendiente',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
}

export type StatusTone = 'attention' | 'done' | 'neutral'

export function reportStatusTone(status: ReportStatus): StatusTone {
  if (status === 'open') return 'attention'
  if (status === 'resolved') return 'done'
  return 'neutral'
}

export function tabForStatus(status: ReportStatus): ReportTab {
  return status === 'open' ? 'pending' : 'closed'
}

// Lo que hace el back: dismiss → dismissed; resolve y ban → resolved (ban además suspende la cuenta).
export function statusAfterAction(action: ReportAction): ReportStatus {
  return action === 'dismiss' ? 'dismissed' : 'resolved'
}

export const ACTION_SUCCESS: Record<ReportAction, string> = {
  dismiss: 'Reporte descartado.',
  resolve: 'Reporte resuelto.',
  ban: 'Cuenta suspendida y reporte resuelto.',
}

export function reasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? 'Otro motivo'
}

export function accountStatusLabel(status: UserStatus): string {
  return status === 'banned' ? 'Suspendida' : 'Activa'
}

// El back devuelve como máximo 200 reportes por estado: más allá no hay conteo exacto.
export const REPORTS_PAGE_CAP = 200

export function pendingCountLabel(count: number): string {
  return count >= REPORTS_PAGE_CAP ? `${REPORTS_PAGE_CAP}+` : String(count)
}

export function priorReportsLabel(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 reporte anterior contra esta cuenta' : `${count} reportes anteriores contra esta cuenta`
}

// Resueltos: lo más reciente arriba (los pendientes ya vienen del más antiguo al más nuevo).
export function sortClosed(reports: readonly AdminReport[]): AdminReport[] {
  const key = (r: AdminReport) => Date.parse(r.resolvedAt ?? r.createdAt) || 0
  return [...reports].sort((a, b) => key(b) - key(a))
}
