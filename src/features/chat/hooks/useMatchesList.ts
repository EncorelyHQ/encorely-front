import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { matchesApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'
import { hasMessages, sortByActivity } from '../data/matchCopy'

export function useMatchesList() {
  const query = useQuery({ queryKey: queryKeys.matches, queryFn: matchesApi.list })
  const sections = useMemo(() => {
    const active = (query.data ?? []).filter((m) => m.status === 'active')
    const sorted = sortByActivity(active)
    return {
      fresh: sorted.filter((m) => !hasMessages(m)),
      conversations: sorted.filter(hasMessages),
    }
  }, [query.data])
  return { ...query, ...sections }
}
