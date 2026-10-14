import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { font, IconButton, PaperPlaneRightIcon, radius, space, Text, touch, type, useStyles, useTheme, type Theme } from '@/ui'
import { MAX_MESSAGE_LENGTH } from '../data/messages'

type Props = {
  // Devuelve false si no se pudo encolar (vacío, muy largo, sin llaves): el texto se conserva.
  onSend: (text: string) => boolean
  disabled?: boolean
}

// El contador aparece solo cuando importa, para no meter ruido en cada mensaje corto.
const WARN_AT = MAX_MESSAGE_LENGTH - 200
const MAX_INPUT_HEIGHT = touch.comfortable * 3

export function Composer({ onSend, disabled }: Props) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const [text, setText] = useState('')
  const length = text.trim().length
  const tooLong = length > MAX_MESSAGE_LENGTH
  const canSend = length > 0 && !tooLong && !disabled

  const submit = () => {
    if (!canSend) return
    if (onSend(text)) setText('')
  }

  return (
    <View style={styles.wrap}>
      {length >= WARN_AT ? (
        <Text
          variant="caption"
          color={tooLong ? 'danger' : 'textMuted'}
          style={styles.counter}
          accessibilityLiveRegion="polite"
        >
          {tooLong
            ? `Máximo ${MAX_MESSAGE_LENGTH} caracteres. Te sobran ${length - MAX_MESSAGE_LENGTH}.`
            : `${length} / ${MAX_MESSAGE_LENGTH}`}
        </Text>
      ) : null}
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje"
          placeholderTextColor={theme.textSubtle}
          multiline
          editable={!disabled}
          accessibilityLabel="Mensaje"
          accessibilityState={{ disabled: !!disabled }}
          style={styles.input}
          cursorColor={theme.accent}
          selectionColor={theme.accent}
          textAlignVertical="center"
        />
        <IconButton
          icon={PaperPlaneRightIcon}
          label="Enviar"
          tone="accent"
          weight="fill"
          disabled={!canSend}
          onPress={submit}
        />
      </View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.xs },
    counter: { paddingHorizontal: space.lg },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
    input: {
      flex: 1,
      minHeight: touch.comfortable,
      maxHeight: MAX_INPUT_HEIGHT,
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      paddingBottom: space.md,
      borderRadius: radius.md + space.sm,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface2,
      color: t.text,
      fontFamily: font.body,
      fontSize: type.body.fontSize,
      // Sin lineHeight fijo: en Android un multiline con lineHeight corta los descendentes al crecer.
    },
  })
