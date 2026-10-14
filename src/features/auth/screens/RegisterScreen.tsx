import { useRef, useState } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { userMessage } from '@/lib/api/errors'
import { authApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'
import { useSession } from '@/lib/session/SessionContext'
import { Alert, Button, Checkbox, haptics, Screen, space, Text, TextField, useStyles, useTheme, useToast, type Theme } from '@/ui'
import { PasswordField } from '../components/PasswordField'
import { TextLink } from '../components/TextLink'
import { registerErrors, type RegisterField } from '../lib/errors'
import { consentVersionOf, legalLinksOf } from '../lib/legal'
import { displayNameError, emailError, newPasswordError, normalizeEmail, PASSWORD_MIN_LENGTH } from '../lib/validation'

type Errors = Partial<Record<RegisterField, string>>

const CONSENT_LABEL = 'Acepto los términos y la política de tratamiento de datos (Ley 1581 de 2012).'

export function RegisterScreen() {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { signUp } = useSession()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [general, setGeneral] = useState<string | null>(null)
  const nameRef = useRef<TextInput>(null)
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  const legal = useQuery({ queryKey: queryKeys.legal, queryFn: authApi.legal })
  const consentVersion = consentVersionOf(legal.data)
  const links = legalLinksOf(legal.data)

  const register = useMutation({ mutationFn: signUp })
  const busy = register.isPending

  const openLegal = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, { controlsColor: theme.accent, toolbarColor: theme.bg })
    } catch (error) {
      toast.show(userMessage(error), 'danger')
    }
  }

  const submit = () => {
    if (busy) return
    const local: Errors = {}
    const nameMsg = displayNameError(displayName)
    const emailMsg = emailError(email)
    const passwordMsg = newPasswordError(password)
    if (nameMsg) local.displayName = nameMsg
    if (emailMsg) local.email = emailMsg
    if (passwordMsg) local.password = passwordMsg
    if (!accepted) local.consent = 'Para crear la cuenta necesitas aceptar los términos.'
    setErrors(local)
    setGeneral(null)

    if (Object.keys(local).length) {
      haptics.warning()
      const firstRef = nameMsg ? nameRef : emailMsg ? emailRef : passwordMsg ? passwordRef : null
      firstRef?.current?.focus()
      return
    }

    if (!consentVersion) {
      haptics.warning()
      setGeneral('No pudimos cargar los términos. Revisa tu conexión y vuelve a intentarlo.')
      void legal.refetch()
      return
    }

    register.mutate(
      {
        displayName: displayName.trim(),
        email: normalizeEmail(email),
        password,
        acceptTerms: true,
        consentVersion,
      },
      {
        onError: (error) => {
          const mapped = registerErrors(error)
          haptics.warning()
          setErrors(mapped.fields)
          setGeneral(mapped.general)
          // La versión cambió en el servidor: hay que volver a leerla y a aceptarla de forma explícita.
          if (mapped.fields.consent) {
            setAccepted(false)
            void legal.refetch()
          }
          if (mapped.fields.email) emailRef.current?.focus()
        },
      },
    )
  }

  const edit = (field: RegisterField, setter: (value: string) => void) => (value: string) => {
    setter(value)
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (general) setGeneral(null)
  }

  return (
    <Screen mode="form" edges={['bottom']}>
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">
          Crea tu cuenta
        </Text>
        <Text variant="body" color="textMuted">
          Encorely es solo para mayores de 18 años.
        </Text>
      </View>

      <View style={styles.fields}>
        <TextField
          ref={nameRef}
          label="Tu nombre"
          helper="Así te verán las demás personas. Puedes cambiarlo después."
          value={displayName}
          onChangeText={edit('displayName', setDisplayName)}
          error={errors.displayName}
          textContentType="name"
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          maxLength={50}
          editable={!busy}
        />
        <TextField
          ref={emailRef}
          label="Correo"
          value={email}
          onChangeText={edit('email', setEmail)}
          error={errors.email}
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!busy}
        />
        <PasswordField
          ref={passwordRef}
          label="Contraseña"
          helper={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres. Una frase corta que recuerdes funciona bien.`}
          value={password}
          onChangeText={edit('password', setPassword)}
          error={errors.password}
          textContentType="newPassword"
          autoComplete="new-password"
          passwordRules={`minlength: ${PASSWORD_MIN_LENGTH};`}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          editable={!busy}
        />

        <View style={styles.consent}>
          <Checkbox
            checked={accepted}
            onChange={(value) => {
              setAccepted(value)
              if (errors.consent) setErrors((prev) => ({ ...prev, consent: undefined }))
            }}
            label={CONSENT_LABEL}
            error={errors.consent}
            disabled={busy}
          />
          {links.length ? (
            <View style={styles.links}>
              {links.map((link) => (
                <TextLink
                  key={link.key}
                  label={link.label}
                  hint="Se abre en el navegador"
                  onPress={() => void openLegal(link.url)}
                />
              ))}
            </View>
          ) : null}
          {legal.isError ? (
            <View style={styles.legalError}>
              <Alert message="No pudimos cargar los términos. Sin ellos no podemos crear la cuenta." />
              <TextLink label="Reintentar" role="button" onPress={() => void legal.refetch()} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        {general ? <Alert message={general} /> : null}
        <Button label="Crear cuenta" size="lg" loading={busy} onPress={submit} />
        <View style={styles.switch}>
          <Text variant="callout" color="textMuted">
            ¿Ya tienes cuenta?
          </Text>
          <TextLink label="Entra" role="button" onPress={() => router.replace('/login')} />
        </View>
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    header: { gap: space.sm, marginBottom: space.xl },
    fields: { gap: space.lg },
    consent: { gap: space.xs, marginTop: space.sm },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, paddingLeft: space.xl + space.md },
    legalError: { gap: space.xs },
    spacer: { flexGrow: 1, minHeight: space.xl },
    actions: { gap: space.md },
    switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space.sm },
  })
