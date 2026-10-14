import { router } from 'expo-router'
import { ListRow } from '@/ui'
import { WrenchIcon } from '../icons'
import { pendingCountLabel } from '../model/reports'
import { useIsAdmin, usePendingReportsCount } from '../hooks/queries'
import { CountBadge } from './StatusTag'

// Fila para "Tú": solo existe para admins (el resto ni la ve ni dispara la consulta de reportes).
export function AdminEntryRow() {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return null
  return <AdminEntryRowInner />
}

function AdminEntryRowInner() {
  const pending = usePendingReportsCount()
  const count = pending.data ?? 0
  const label = count === 1 ? '1 reporte pendiente' : `${pendingCountLabel(count)} reportes pendientes`
  return (
    <ListRow
      title="Administración"
      subtitle="Conciertos, canciones y reportes"
      icon={WrenchIcon}
      trailing={
        count > 0 ? (
<CountBadge count={pendingCountLabel(count)} label={label} />
        ) : undefined
      }
      // La fila entera es el botón: el conteo se anuncia como pista, no como hijo.
      accessibilityHint={count > 0 ? label : undefined}
      onPress={() => router.push('/admin')}
    />
  )
}
