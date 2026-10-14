import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native'
import { haptics } from './haptics'
import { Icon, type PhosphorIcon } from './Icon'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, touch, type Theme } from './tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string
  variant?: Variant
  size?: 'md' | 'lg'
  loading?: boolean
  icon?: PhosphorIcon
  fullWidth?: boolean
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  fullWidth = true,
  onPress,
  ...rest
}: ButtonProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const inactive = disabled || loading
  const fg = foreground(variant)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      onPress={(e) => {
        haptics.selection()
        onPress?.(e)
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        fullWidth ? styles.full : null,
        variantStyle(theme, variant, pressed),
        inactive && !loading ? styles.disabled : null,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={theme[fg] as string} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon icon={icon} size={20} color={fg} weight="bold" /> : null}
          <Text variant="headline" color={fg as 'text'} numberOfLines={2} align="center">
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

function foreground(variant: Variant): 'onAccent' | 'text' | 'danger' {
  if (variant === 'primary') return 'onAccent'
  if (variant === 'destructive') return 'danger'
  return 'text'
}

function variantStyle(theme: Theme, variant: Variant, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return { backgroundColor: pressed ? theme.accentPressed : theme.accent }
    case 'secondary':
      return {
        backgroundColor: pressed ? theme.surface2 : 'transparent',
        borderWidth: 1.5,
        borderColor: theme.text,
      }
    case 'destructive':
      return {
        backgroundColor: pressed ? theme.surface2 : 'transparent',
        borderWidth: 1.5,
        borderColor: theme.danger,
      }
    case 'ghost':
      return { backgroundColor: pressed ? theme.surface2 : 'transparent' }
  }
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.xl,
    },
    md: { minHeight: touch.comfortable, paddingVertical: space.md },
    lg: { minHeight: touch.large, paddingVertical: space.lg },
    full: { alignSelf: 'stretch' },
    disabled: { opacity: 0.45 },
    content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  })
