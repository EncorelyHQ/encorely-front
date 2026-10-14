import {
  accountStatusLabel,
  pendingCountLabel,
  priorReportsLabel,
  reasonLabel,
  REPORT_STATUS_LABEL,
  reportStatusTone,
  sortClosed,
  statusAfterAction,
  tabForStatus,
  TAB_STATUSES,
} from '../model/reports'
import type { AdminReport } from '../types'

const report = (over: Partial<AdminReport>): AdminReport => ({
  id: 'r',
  reporter: null,
  reported: null,
  matchId: null,
  reason: 'spam',
  detail: null,
  evidence: [],
  status: 'open',
  resolutionNote: null,
  createdAt: '2026-10-01T00:00:00Z',
  resolvedAt: null,
  priorReportsAgainstUser: 0,
  ...over,
})

describe('estados de reporte', () => {
  it('cada pestaña pide los estados correctos al back', () => {
    expect(TAB_STATUSES.pending).toEqual(['open'])
    expect(TAB_STATUSES.closed).toEqual(['resolved', 'dismissed'])
  })

  it('cada estado vuelve a su pestaña', () => {
    expect(tabForStatus('open')).toBe('pending')
    expect(tabForStatus('resolved')).toBe('closed')
    expect(tabForStatus('dismissed')).toBe('closed')
  })

  it('la acción define el estado final como lo hace el back', () => {
    expect(statusAfterAction('dismiss')).toBe('dismissed')
    expect(statusAfterAction('resolve')).toBe('resolved')
    expect(statusAfterAction('ban')).toBe('resolved')
  })

  it('etiquetas y tonos', () => {
    expect(REPORT_STATUS_LABEL).toEqual({ open: 'Pendiente', resolved: 'Resuelto', dismissed: 'Descartado' })
    expect(reportStatusTone('open')).toBe('attention')
    expect(reportStatusTone('resolved')).toBe('done')
    expect(reportStatusTone('dismissed')).toBe('neutral')
    expect(accountStatusLabel('banned')).toBe('Suspendida')
    expect(accountStatusLabel('active')).toBe('Activa')
  })

  it('motivos con el mismo texto que ve quien reporta', () => {
    expect(reasonLabel('harassment')).toBe('Acoso o amenazas')
    expect(reasonLabel('fakeProfile')).toBe('Perfil falso')
  })

  it('conteos', () => {
    expect(pendingCountLabel(3)).toBe('3')
    expect(pendingCountLabel(200)).toBe('200+')
    expect(priorReportsLabel(0)).toBeNull()
    expect(priorReportsLabel(1)).toBe('1 reporte anterior contra esta cuenta')
    expect(priorReportsLabel(4)).toBe('4 reportes anteriores contra esta cuenta')
  })

  it('resueltos: lo más reciente primero, por fecha de resolución', () => {
    const a = report({ id: 'a', status: 'resolved', resolvedAt: '2026-10-05T00:00:00Z' })
    const b = report({ id: 'b', status: 'dismissed', resolvedAt: '2026-10-09T00:00:00Z' })
    const c = report({ id: 'c', status: 'resolved', resolvedAt: null, createdAt: '2026-10-07T00:00:00Z' })
    expect(sortClosed([a, b, c]).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})
