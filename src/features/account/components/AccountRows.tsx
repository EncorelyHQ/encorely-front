import { router } from 'expo-router'
import { ListRow } from '@/ui'
import { DevicesIcon } from 'phosphor-react-native/src/icons/Devices'
import { ScalesIcon } from 'phosphor-react-native/src/icons/Scales'

// Filas listas para montar en la lista de ajustes de "Tú" (el orquestador decide en qué sección van).
export function SessionsRow() {
  return (
    <ListRow
      title="Sesiones abiertas"
      subtitle="Dónde está abierta tu cuenta"
      icon={DevicesIcon}
      onPress={() => router.push('/settings/sessions')}
    />
  )
}

export function LegalRow() {
  return (
    <ListRow
      title="Términos y privacidad"
      subtitle="Documentos, versión vigente y reclamos"
      icon={ScalesIcon}
      onPress={() => router.push('/settings/legal')}
    />
  )
}
