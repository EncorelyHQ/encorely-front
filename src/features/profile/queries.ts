import { useQuery } from '@tanstack/react-query'
import { catalogApi, meApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'

const HOUR = 60 * 60 * 1000

export const useMeQuery = () => useQuery({ queryKey: queryKeys.me, queryFn: meApi.get })

export const useDnaQuery = () => useQuery({ queryKey: queryKeys.dna, queryFn: meApi.dna })

// El catálogo de géneros casi no cambia: se pide una vez por sesión.
export const useGenresQuery = () =>
  useQuery({ queryKey: queryKeys.genres, queryFn: catalogApi.genres, staleTime: HOUR })
