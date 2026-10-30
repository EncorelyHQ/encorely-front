import { router } from 'expo-router'
import { ArrowsLeftRightIcon } from 'phosphor-react-native/src/icons/ArrowsLeftRight'
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp'
import { ListRow } from '@/ui'

// Filas para "Tú": el perfil las pone en su lista sin conocer las rutas del chat.
export function ChatBackupRow() {
  return (
    <ListRow
      icon={CloudArrowUpIcon}
      title="Respaldo cifrado de tus chats"
      subtitle="Llaves e historial, cifrados con una frase tuya"
      onPress={() => router.push('/chat-backup')}
    />
  )
}

export function LinkDeviceRow() {
  return (
    <ListRow
      icon={ArrowsLeftRightIcon}
      title="Vincular otro teléfono"
      subtitle="Pasa tus llaves del chat a un teléfono nuevo"
      onPress={() => router.push('/link-device')}
    />
  )
}
