import { forwardRef, useState, type ReactNode } from 'react'
import { StyleSheet, View, type TextInput, type TextInputProps } from 'react-native'
import {
  EyeIcon,
  EyeSlashIcon,
  Icon,
  IconButton,
  radius,
  space,
  Text,
  TextField,
  useStyles,
  type PhosphorIcon,
  type Theme,
} from '@/ui'
import type { PassphraseStrength } from '../backup/passphrase'

type PassphraseFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string
  helper?: string
  error?: string | null
}

// La frase se escribe una vez y no se recupera: poder verla antes de confirmar evita guardar un typo para siempre.
export const PassphraseField = forwardRef<TextInput, PassphraseFieldProps>(function PassphraseField(props, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      ref={ref}
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
      importantForAutofill="no"
      textContentType="none"
      trailing={
        <IconButton
          icon={visible ? EyeSlashIcon : EyeIcon}
          label={visible ? 'Ocultar la frase' : 'Mostrar la frase'}
          color="textMuted"
          onPress={() => setVisible((v) => !v)}
        />
      }
    />
  )
})

const LEVEL_LABEL: Record<PassphraseStrength['level'], string> = {
  empty: 'Sin frase',
  weak: 'Débil',
  fair: 'Aceptable',
  strong: 'Fuerte',
}

const FILLED: Record<PassphraseStrength['level'], number> = { empty: 0, weak: 1, fair: 2, strong: 3 }

// Tres segmentos y una palabra: el color solo refuerza, la palabra es la que informa (no depende del color).
export function StrengthMeter({ strength }: { strength: PassphraseStrength }) {
  const styles = useStyles(makeStyles)
  const filled = FILLED[strength.level]
  const tone = strength.level === 'weak' ? styles.weak : strength.level === 'strong' ? styles.strong : styles.fair
  return (
    <View
      style={styles.meter}
      accessible
      accessibilityLabel={`Fuerza de la frase: ${LEVEL_LABEL[strength.level]}. ${strength.hint}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.segments}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.segment, i < filled ? tone : null]} />
        ))}
      </View>
      <Text variant="footnote" color={strength.ok ? 'textMuted' : 'textSubtle'}>
        <Text variant="footnote" color="text">
          {LEVEL_LABEL[strength.level]}.
        </Text>{' '}
        {strength.hint}
      </Text>
    </View>
  )
}

/** Barra de avance de la derivación de la llave (scrypt tarda varios segundos en el teléfono). */
export function ProgressLine({ progress, label }: { progress: number; label: string }) {
  const styles = useStyles(makeStyles)
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <View
      style={styles.progress}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={styles.track}>
        {/* scaleX y no width: el avance llega muchas veces por segundo y así no recalcula layout. */}
        <View style={[styles.fill, { transform: [{ scaleX: pct / 100 }] }]} />
      </View>
      <Text variant="footnote" color="textMuted">
        {label} <Text variant="data">{pct} %</Text>
      </Text>
    </View>
  )
}

/** Aviso con icono en línea. El tono va solo en el icono: el bloque entero en color sería alarma, no información. */
export function Callout({
  icon,
  tone = 'textMuted',
  children,
}: {
  icon: PhosphorIcon
  tone?: 'textMuted' | 'danger' | 'verified' | 'accent'
  children: ReactNode
}) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.callout}>
      <Icon icon={icon} size={20} color={tone} weight="fill" />
      <View style={styles.flex}>{children}</View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    meter: { gap: space.sm },
    segments: { flexDirection: 'row', gap: space.xs },
    segment: { flex: 1, height: space.xs, borderRadius: radius.full, backgroundColor: t.surface2 },
    weak: { backgroundColor: t.danger },
    fair: { backgroundColor: t.accent },
    strong: { backgroundColor: t.verified },
    progress: { gap: space.sm },
    track: { height: space.xs, borderRadius: radius.full, backgroundColor: t.surface2, overflow: 'hidden' },
    fill: { height: '100%', width: '100%', backgroundColor: t.accent, transformOrigin: 'left' },
    callout: {
      flexDirection: 'row',
      gap: space.md,
      alignItems: 'flex-start',
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    flex: { flex: 1, gap: space.xs },
  })
