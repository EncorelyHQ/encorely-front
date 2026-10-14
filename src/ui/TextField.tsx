import { forwardRef, useState, type ReactNode } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, touch, type as typeScale, type Theme } from './tokens'

type TextFieldProps = TextInputProps & {
  label: string
  helper?: string
  error?: string | null
  // Accesorio dentro del campo, a la derecha (p. ej. el ojo de la contraseña); centrado en la caja del input.
  trailing?: ReactNode
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, helper, error, trailing, style, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const [focused, setFocused] = useState(false)
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.borderInput

  return (
    <View style={styles.wrap}>
      <Text variant="callout" color="textMuted" nativeID={`${label}-label`}>
        {label}
      </Text>
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${label}-label`}
          accessibilityHint={error ?? helper}
          placeholderTextColor={theme.textSubtle}
          selectionColor={theme.accent}
          cursorColor={theme.accent}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[styles.input, { borderColor, borderWidth: focused || error ? 2 : 1.5 }, trailing ? styles.inputWithTrailing : null, style]}
          {...rest}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="footnote" color="textSubtle">
          {helper}
        </Text>
      ) : null}
    </View>
  )
})

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.xs + 2 },
    input: {
      ...typeScale.body,
      minHeight: touch.comfortable + 4,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.sm,
      backgroundColor: t.surface,
      color: t.text,
    },
    inputWithTrailing: { paddingRight: touch.min + space.sm },
    trailing: { position: 'absolute', top: 0, bottom: 0, right: space.xs, justifyContent: 'center' },
  })
