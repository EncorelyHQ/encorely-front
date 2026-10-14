import { useLocalSearchParams } from 'expo-router'
import { AdminEventFormScreen } from '@/features/admin'

export default function EditEventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AdminEventFormScreen eventId={id} />
}
