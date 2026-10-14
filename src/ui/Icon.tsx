import type { ComponentType } from 'react'
import type { IconProps as PhosphorProps } from 'phosphor-react-native'
import { useTheme } from './theme'
import type { Theme } from './tokens'

export type PhosphorIcon = ComponentType<PhosphorProps>

type IconProps = {
  icon: PhosphorIcon
  size?: 16 | 20 | 24 | 28 | 32 | 40
  color?: keyof Theme
  weight?: PhosphorProps['weight']
}

// Decorativo por defecto: si el icono va solo, el label lo pone el contenedor táctil (IconButton).
export function Icon({ icon: Glyph, size = 24, color = 'text', weight = 'regular' }: IconProps) {
  const theme = useTheme()
  return (
    <Glyph
      size={size}
      color={theme[color] as string}
      weight={weight}
    />
  )
}
