import { useLocalSearchParams } from 'expo-router'
import { SecurityScreen } from '@/features/chat'

export default function SecurityRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  return <SecurityScreen matchId={matchId} />
}
