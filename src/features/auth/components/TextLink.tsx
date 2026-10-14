import { Pressable, StyleSheet } from 'react-native'
import { haptics, radius, space, Text, touch, useStyles, type Theme } from '@/ui'

type TextLinkProps = {
  label: string
  onPress: () => void
  role?: 'link' | 'button'
  hint?: string
}

// Enlace de texto con área táctil de 44 pt: para acciones secundarias que no merecen un botón.
export function TextLink({ label, onPress, role = 'link', hint }: TextLinkProps) {
  const styles = useStyles(makeStyles)
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        haptics.selection()
        onPress()
      }}
      style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
    >
      <Text variant="callout" color="accentText" style={styles.text}>
        {label}
      </Text>
    </Pressable>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    link: {
      minHeight: touch.min,
      justifyContent: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: space.sm,
      marginHorizontal: -space.sm,
      borderRadius: radius.sm,
    },
    pressed: { backgroundColor: t.surface2 },
    text: { textDecorationLine: 'underline' },
  })
