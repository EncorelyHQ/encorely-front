import { forwardRef, useState } from 'react'
import { type TextInput, type TextInputProps } from 'react-native'
import { EyeIcon, EyeSlashIcon, IconButton, TextField } from '@/ui'

type PasswordFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string
  helper?: string
  error?: string | null
}

export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      ref={ref}
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      trailing={
        <IconButton
          icon={visible ? EyeSlashIcon : EyeIcon}
          label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          color="textMuted"
          onPress={() => setVisible((v) => !v)}
        />
      }
    />
  )
})
