import { useLocalSearchParams } from 'expo-router'
import { ScanScreen } from '@/features/chat'

export default function ScanRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  return <ScanScreen matchId={matchId} />
}
