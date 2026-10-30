import { useLocalSearchParams } from 'expo-router'
import { ConversationScreen } from '@/features/chat'

export default function ConversationRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>()
  return <ConversationScreen matchId={matchId} />
}
