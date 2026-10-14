import { forwardRef, useState } from 'react'
import { StyleSheet, View, type LayoutRectangle, type TextInput, type TextInputProps } from 'react-native'
import { EyeIcon, EyeSlashIcon, IconButton, space, TextField, touch, useStyles, type Theme } from '@/ui'

type PasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string
  helper?: string
  error?: string | null
}

// TextField no tiene accesorio a la derecha: se mide el input y el botón de ojo se monta encima,
// así el ojo queda centrado en el campo aunque el label o el error crezcan con el tamaño de fuente.
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(props, ref) {
  const styles = useStyles(makeStyles)
  const [visible, setVisible] = useState(false)
  const [box, setBox] = useState<LayoutRectangle | null>(null)

  return (
    <View>
      <TextField
        ref={ref}
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={styles.input}
        onLayout={(e) => setBox(e.nativeEvent.layout)}
      />
      {box ? (
        <View style={[styles.toggle, { top: box.y + (box.height - touch.min) / 2 }]}>
          <IconButton
            icon={visible ? EyeSlashIcon : EyeIcon}
            label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            color="textMuted"
            onPress={() => setVisible((v) => !v)}
          />
        </View>
      ) : null}
    </View>
  )
})

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    input: { paddingRight: touch.min + space.sm },
    toggle: { position: 'absolute', right: space.xs },
  })
