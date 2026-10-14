import { useLocalSearchParams } from 'expo-router'
import { AdminSongEditScreen } from '@/features/admin'

export default function EditSongRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AdminSongEditScreen songId={id} />
}
