import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { backupApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'
import { useChatDeps } from '../data/ChatDepsContext'
import { backupInfo, estimateHistory, type BackupTransport } from './backup'

export const backupTransport: BackupTransport = backupApi

// Claves propias del módulo: el respaldo no es estado de otra pantalla.
export const backupQueryKeys = {
  info: ['me', 'chat-backup'] as const,
  estimate: (me: string) => ['me', 'chat-backup', 'estimate', me] as const,
}

export function useBackupInfo() {
  return useQuery({ queryKey: backupQueryKeys.info, queryFn: () => backupInfo(backupTransport) })
}

export function useHistoryEstimate(me: string, enabled: boolean) {
  const deps = useChatDeps()
  return useQuery({
    queryKey: backupQueryKeys.estimate(me),
    queryFn: () => estimateHistory(deps, me),
    enabled,
    // El historial cambia con cada mensaje: se mide al abrir el formulario.
    staleTime: 0,
    gcTime: 0,
  })
}

// Tras instalar llaves de otro lado, lo descifrado en memoria y las llaves del otro en caché ya no valen.
export function resetChatCaches(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'matches' && q.queryKey.length === 3 })
  void queryClient.invalidateQueries({ queryKey: queryKeys.matches })
}

export function useResetChatCaches() {
  const queryClient = useQueryClient()
  return () => resetChatCaches(queryClient)
}
