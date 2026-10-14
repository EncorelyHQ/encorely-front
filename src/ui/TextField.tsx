import { forwardRef, useState } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, touch, type as typeScale, type Theme } from './tokens'

type TextFieldProps = TextInputProps & {
  label: string
  helper?: string
  error?: string | null
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, helper, error, style, onFocus, onBlur, ...rest },
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
        style={[styles.input, { borderColor, borderWidth: focused || error ? 2 : 1.5 }, style]}
        {...rest}
      />
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
  })
