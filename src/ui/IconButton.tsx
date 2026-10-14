import { Pressable, type PressableProps } from 'react-native'
import { haptics } from './haptics'
import { Icon, type PhosphorIcon } from './Icon'
import { useTheme } from './theme'
import { radius, touch, type Theme } from './tokens'

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: PhosphorIcon
  // Obligatorio: es el único texto que oye TalkBack/VoiceOver.
  label: string
  size?: 'md' | 'lg' | 'xl'
  tone?: 'plain' | 'filled' | 'outline' | 'accent'
  color?: keyof Theme
  weight?: 'regular' | 'bold' | 'fill'
}

const dims = { md: touch.min, lg: touch.large, xl: 64 } as const

export function IconButton({
  icon,
  label,
  size = 'md',
  tone = 'plain',
  color,
  weight = 'regular',
  onPress,
  disabled,
  ...rest
}: IconButtonProps) {
  const theme = useTheme()
  const d = dims[size]
  const fg: keyof Theme = color ?? (tone === 'accent' ? 'onAccent' : 'text')
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={Math.max(0, (touch.comfortable - d) / 2)}
      disabled={disabled}
      onPress={(e) => {
        haptics.selection()
        onPress?.(e)
      }}
      style={({ pressed }) => ({
        width: d,
        height: d,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
        backgroundColor:
          tone === 'accent'
            ? pressed
              ? theme.accentPressed
              : theme.accent
            : tone === 'filled'
              ? pressed
                ? theme.border
                : theme.surface2
              : pressed
                ? theme.surface2
                : 'transparent',
        borderWidth: tone === 'outline' ? 1.5 : 0,
        borderColor: theme.borderInput,
      })}
      {...rest}
    >
      <Icon icon={icon} size={size === 'md' ? 24 : 28} color={fg} weight={weight} />
    </Pressable>
  )
}
