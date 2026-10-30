import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native'
import { useTheme } from './theme'
import { maxFontScale, type, type Theme, type TypeVariant } from './tokens'

type ColorToken = Extract<
  keyof Theme,
  | 'text'
  | 'textMuted'
  | 'textSubtle'
  | 'accentText'
  | 'onAccent'
  | 'onTicket'
  | 'onTicketMuted'
  | 'ticketAccent'
  | 'verified'
  | 'danger'
>

export type TextProps = RNTextProps & {
  variant?: TypeVariant
  color?: ColorToken
  align?: TextStyle['textAlign']
}

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const theme = useTheme()
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      {...rest}
      style={[type[variant] as TextStyle, { color: theme[color] }, align ? { textAlign: align } : null, style]}
    />
  )
}
