import { View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius } from './tokens'

type AvatarProps = { name: string; size?: 40 | 48 | 56 | 72 | 96 }

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

// Sin fotos en la v1: iniciales sobre papel, nunca caras de relleno.
export function Avatar({ name, size = 48 }: AvatarProps) {
  const theme = useTheme()
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: theme.ticket,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant={size >= 72 ? 'title1' : 'headline'}
        color="onTicket"
        allowFontScaling={false}
        style={size >= 72 ? { fontSize: size * 0.38, lineHeight: size * 0.44 } : null}
      >
        {initials(name)}
      </Text>
    </View>
  )
}
