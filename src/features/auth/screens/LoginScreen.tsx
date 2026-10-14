import { useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useSession } from '@/lib/session/SessionContext'
import { Button, haptics, Screen, space, Text, TextField, useStyles, type Theme } from '@/ui'
import { FormAlert } from '../components/FormAlert'
import { PasswordField } from '../components/PasswordField'
import { TextLink } from '../components/TextLink'
import { loginErrors, type LoginField } from '../lib/errors'
import { emailError, loginPasswordError, normalizeEmail } from '../lib/validation'

type Errors = Partial<Record<LoginField, string>>

export function LoginScreen() {
  const styles = useStyles(makeStyles)
  const { signIn, notice } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  const login = useMutation({ mutationFn: signIn })

  const submit = () => {
    if (login.isPending) return
    const local: Errors = {}
    const emailMsg = emailError(email)
    const passwordMsg = loginPasswordError(password)
    if (emailMsg) local.email = emailMsg
    if (passwordMsg) local.password = passwordMsg
    setErrors(local)
    setGeneral(null)
    if (emailMsg || passwordMsg) {
      haptics.warning()
      ;(emailMsg ? emailRef : passwordRef).current?.focus()
      return
    }
    login.mutate(
      { email: normalizeEmail(email), password },
      {
        onError: (error) => {
          const mapped = loginErrors(error)
          haptics.warning()
          setErrors(mapped.fields)
          setGeneral(mapped.general)
        },
      },
    )
  }

  // Corregir un campo borra su error: el mensaje no se queda gritando mientras la persona escribe.
  const edit = (field: LoginField, setter: (value: string) => void) => (value: string) => {
    setter(value)
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (general) setGeneral(null)
  }

  return (
    <Screen mode="form" edges={['bottom']}>
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">
          Entra a tu cuenta
        </Text>
        {notice ? <FormAlert tone="info" message={notice} /> : null}
      </View>

      <View style={styles.fields}>
        <TextField
          ref={emailRef}
          label="Correo"
          value={email}
          onChangeText={edit('email', setEmail)}
          error={errors.email}
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          inputMode="email"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!login.isPending}
        />
        <PasswordField
          ref={passwordRef}
          label="Contraseña"
          value={password}
          onChangeText={edit('password', setPassword)}
          error={errors.password}
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="go"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={submit}
          editable={!login.isPending}
        />
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        {general ? <FormAlert message={general} /> : null}
        <Button label="Entrar" size="lg" loading={login.isPending} onPress={submit} />
        <View style={styles.switch}>
          <Text variant="callout" color="textMuted">
            ¿No tienes cuenta?
          </Text>
          <TextLink label="Crea una" role="button" onPress={() => router.replace('/register')} />
        </View>
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    header: { gap: space.lg, marginBottom: space.xl },
    fields: { gap: space.lg },
    spacer: { flexGrow: 1, minHeight: space.xl },
    actions: { gap: space.md },
    switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space.sm },
  })
