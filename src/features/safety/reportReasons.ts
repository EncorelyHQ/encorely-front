import type { ReportReason } from '@/lib/api/types'

export type ReportReasonOption = { value: ReportReason; label: string }

export const REPORT_REASONS: readonly ReportReasonOption[] = [
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'harassment', label: 'Acoso o amenazas' },
  { value: 'inappropriate', label: 'Contenido inapropiado' },
  { value: 'fakeProfile', label: 'Perfil falso' },
  { value: 'underage', label: 'Parece menor de edad' },
  { value: 'other', label: 'Otro motivo' },
]

// Límites del back (ReportRequest): 1000 caracteres de detalle y 20 mensajes de evidencia.
export const REPORT_DETAIL_MAX = 1000
export const REPORT_EVIDENCE_MAX = 20

export function evidenceLabel(count: number): string {
  return count === 1
    ? 'Adjuntar el último mensaje. Se enviará sin cifrar al equipo de moderación.'
    : `Adjuntar los últimos ${count} mensajes. Se enviarán sin cifrar al equipo de moderación.`
}
