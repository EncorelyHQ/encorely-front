import { useLocalSearchParams } from 'expo-router'
import { MatchScreen, type MatchRouteParams } from '@/features/match'

export default function MatchRoute() {
  const params = useLocalSearchParams<MatchRouteParams>()
  return <MatchScreen params={params} />
}
