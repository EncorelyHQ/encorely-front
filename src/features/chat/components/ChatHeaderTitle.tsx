import { Pressable, StyleSheet, View } from 'react-native'
import { Icon, LockKeyIcon, radius, ShieldCheckIcon, space, Text, useStyles, WarningIcon, type PhosphorIcon, type Theme } from '@/ui'
import type { PeerTrustState } from '../keys'

type Props = {
  name: string
  trust: PeerTrustState | null
  onPress?: () => void
}

type Indicator = { icon: PhosphorIcon; label: string; color: 'textMuted' | 'verified' | 'danger'; weight: 'regular' | 'fill' }

export function trustIndicator(trust: PeerTrustState | null): Indicator {
  // Estado primero y corto: en el header angosto el final es lo que se corta.
  if (trust === 'verified') return { icon: ShieldCheckIcon, label: 'Verificado · Cifrado', color: 'verified', weight: 'fill' }
  if (trust === 'changed') return { icon: WarningIcon, label: 'El código cambió', color: 'danger', weight: 'fill' }
  return { icon: LockKeyIcon, label: 'Sin verificar · Cifrado', color: 'textMuted', weight: 'regular' }
}

// Una sola señal de cifrado, discreta y bajo el nombre (03 §5.8): ni banner por mensaje ni escudo gigante.
export function ChatHeaderTitle({ name, trust, onPress }: Props) {
  const styles = useStyles(makeStyles)
  const indicator = trustIndicator(trust)
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      accessibilityLabel={`${name}. ${indicator.label}`}
      accessibilityHint="Abre el código de seguridad"
      hitSlop={space.sm}
      style={({ pressed }) => [styles.wrap, pressed ? styles.pressed : null]}
    >
      <Text variant="headline" numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.indicator}>
        <Icon icon={indicator.icon} size={16} color={indicator.color} weight={indicator.weight} />
        <Text variant="footnote" color={indicator.color} numberOfLines={1} style={styles.label}>
          {indicator.label}
        </Text>
      </View>
    </Pressable>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { paddingVertical: space.xs / 2, paddingHorizontal: space.xs, borderRadius: radius.sm, maxWidth: '100%' },
    pressed: { backgroundColor: t.surface2 },
    indicator: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    label: { flexShrink: 1 },
  })
