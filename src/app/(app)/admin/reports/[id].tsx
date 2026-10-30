import { useLocalSearchParams } from 'expo-router'
import { AdminReportDetailScreen } from '@/features/admin'

const STATUSES = ['open', 'resolved', 'dismissed'] as const

export default function ReportDetailRoute() {
  const { id, status } = useLocalSearchParams<{ id: string; status?: string }>()
  // El estado solo orienta en qué lista buscar primero; un valor raro se ignora.
  const hint = STATUSES.find((s) => s === status)
  return <AdminReportDetailScreen reportId={id} statusHint={hint} />
}
