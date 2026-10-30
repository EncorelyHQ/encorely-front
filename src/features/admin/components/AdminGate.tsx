import type { ReactNode } from 'react'
import { router, Stack } from 'expo-router'
import { isApiError, userMessage } from '@/lib/api/errors'
import { EmptyState, ErrorState, LockKeyIcon, Screen } from '@/ui'
import { useIsAdmin } from '../hooks/queries'

function NoAccess() {
  return (
    <EmptyState
      icon={LockKeyIcon}
      title="No tienes acceso"
      body="Esta sección es solo para el equipo de Encorely."
      action={{ label: 'Volver', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) }}
    />
  )
}

// Guard de cliente: evita pedir datos que el back igual negaría (403). El back es quien manda.
export function AdminGate({ title, children }: { title: string; children: ReactNode }) {
  const isAdmin = useIsAdmin()
  if (!isAdmin) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title }} />
        <NoAccess />
      </Screen>
    )
  }
  return children
}

type QueryErrorProps = { error: unknown; title: string; onRetry: () => void; retrying?: boolean }

// Si el rol se quitó en BD mientras la app seguía abierta, el back responde 403: se trata igual que el guard.
export function AdminQueryError({ error, title, onRetry, retrying }: QueryErrorProps) {
  if (isApiError(error) && error.kind === 'http' && error.status === 403) return <NoAccess />
  return <ErrorState title={title} message={userMessage(error)} onRetry={onRetry} retrying={retrying} />
}
