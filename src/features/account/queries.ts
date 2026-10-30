import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountApi, authApi, meApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'

const HOUR = 60 * 60 * 1000

export const accountKeys = {
  sessions: ['account', 'sessions'] as const,
  acceptConsent: ['account', 'consent'] as const,
}

export function useSessionsQuery() {
  return useQuery({
    queryKey: accountKeys.sessions,
    queryFn: accountApi.sessions,
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: accountApi.revokeSession,
    onSettled: () => qc.invalidateQueries({ queryKey: accountKeys.sessions }),
  })
}

// El back solo cierra una o TODAS; "todas las demás" son N cierres. Se reporta cuántas fallaron en vez de abortar.
export function useRevokeOtherSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((sessionId) => accountApi.revokeSession(sessionId)))
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) throw (failed[0] as PromiseRejectedResult).reason
      return ids.length
    },
    onSettled: () => qc.invalidateQueries({ queryKey: accountKeys.sessions }),
  })
}

export function useRevokeAllSessions() {
  return useMutation({ mutationFn: accountApi.revokeAllSessions })
}

// Misma llave que el registro: términos y versión salen de una sola caché.
export const useLegalQuery = () => useQuery({ queryKey: queryKeys.legal, queryFn: authApi.legal, staleTime: HOUR })

export const useAccountMeQuery = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.me, queryFn: meApi.get, enabled })

export function useAcceptConsent() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: accountKeys.acceptConsent,
    // Tras aceptar se trae /me: de ahí sale consentUpToDate y el gate se apaga solo.
    mutationFn: async (version: string) => {
      await meApi.consent(version)
      return meApi.get()
    },
    onSuccess: (me) => qc.setQueryData(queryKeys.me, me),
  })
}
