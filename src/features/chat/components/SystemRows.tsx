import { Pressable, StyleSheet, View } from 'react-native'
import { Button, Icon, LockKeyIcon, radius, space, Text, useStyles, WarningIcon, type Theme } from '@/ui'
import { Perforation } from './Perforation'

export function DaySeparator({ label }: { label: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.day} accessibilityRole="header">
      <Perforation />
      <Text variant="data" color="textMuted" style={styles.dayLabel}>
        {label.toUpperCase()}
      </Text>
      <Perforation />
    </View>
  )
}

type IntroProps = { title: string; onSecurityPress: () => void }

// Inicio de la conversación, generado en el teléfono desde el match: el servidor no puede escribir en un chat cifrado.
export function MatchIntroRow({ title, onSecurityPress }: IntroProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.system}>
      <View style={styles.titleRow}>
        <Perforation />
        <Text variant="callout" color="textMuted" align="center" style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Perforation />
      </View>
      <Pressable
        onPress={onSecurityPress}
        accessibilityRole="link"
        accessibilityLabel="Los mensajes se cifran en tu teléfono. Encorely no puede leerlos."
        accessibilityHint="Abre el código de seguridad y lo que debes saber del cifrado"
        style={({ pressed }) => [styles.note, pressed ? styles.pressed : null]}
      >
        <Icon icon={LockKeyIcon} size={16} color="textSubtle" />
        <Text variant="footnote" color="textMuted" align="center" style={styles.noteText}>
          Los mensajes se cifran en tu teléfono. Encorely no puede leerlos.{' '}
          <Text variant="footnote" color="accentText" style={styles.link}>
            Cómo funciona
          </Text>
        </Text>
      </Pressable>
    </View>
  )
}

type KeyChangeProps = { name: string; blocked: boolean; onReview: () => void }

// Solo el icono va en danger: el bloque entero en rojo sería alarma, no información.
export function KeyChangeRow({ name, blocked, onReview }: KeyChangeProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.system} accessibilityRole="alert">
      <View style={styles.titleRow}>
        <Perforation />
        <Icon icon={WarningIcon} size={20} color="danger" weight="fill" />
        <Perforation />
      </View>
      <Text variant="footnote" color="text" align="center" style={styles.noteText}>
        El código de seguridad de {name} cambió. Puede que haya reinstalado la app. Verifícalo antes de compartir algo
        sensible.
      </Text>
      {!blocked ? (
        <Button label="Revisar el código" variant="ghost" fullWidth={false} onPress={onReview} />
      ) : null}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    day: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.lg,
    },
    dayLabel: { letterSpacing: 0.6 },
    system: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
    title: { flexShrink: 1, maxWidth: '75%' },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.xs,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.sm,
      maxWidth: 320,
    },
    noteText: { flexShrink: 1, maxWidth: 320 },
    link: { textDecorationLine: 'underline', textDecorationColor: t.accentText },
    pressed: { backgroundColor: t.surface2 },
  })
