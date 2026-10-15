import { View } from 'react-native'
import { Text } from './Text'
import { useTheme } from './theme'
import { radius, sticker } from './tokens'

// tone 'ink': para pintarlo encima de una boleta, donde el papel de siempre desaparece.
type AvatarProps = { name: string; size?: 40 | 48 | 56 | 72 | 96; tone?: 'paper' | 'ink' }

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

// Sin fotos en la v1: iniciales sobre papel, nunca caras de relleno.
export function Avatar({ name, size = 48, tone = 'paper' }: AvatarProps) {
  const theme = useTheme()
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: tone === 'ink' ? sticker.ink.bg : theme.ticket,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="headline"
        color="onTicket"
        allowFontScaling={false}
        // Siempre Archivo 600: en tamaños grandes solo crece el cuerpo, nunca cambia de familia.
        style={[size >= 72 ? { fontSize: size * 0.38, lineHeight: size * 0.44 } : null, tone === 'ink' ? { color: sticker.ink.fg } : null]}
      >
        {initials(name)}
      </Text>
    </View>
  )
}
