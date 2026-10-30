import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { deleteAccountError, PasswordField } from '@/features/auth'
import { authorizeSpotifyGrant } from '@/features/spotify'
import type { DeleteMeRequest } from '@/lib/api/types'
import { useSession, useUser } from '@/lib/session/SessionContext'
import {
  Alert,
  Button,
  ErrorState,
  haptics,
  Icon,
  LoadingState,
  Screen,
  space,
  Text,
  TextField,
  useStyles,
  useToast,
  WarningIcon,
  type Theme,
} from '@/ui'
import { useMeQuery } from '../queries'
import { DELETE_CONFIRMATION_WORD, isDeleteConfirmation } from '../validation'

export const DELETE_ACCOUNT_SCOPE = 'Tu perfil, tus calificaciones, tus matches y todos tus mensajes. No se puede deshacer.'

// Pantalla y no hoja: escribir con el teclado abierto necesita espacio, y la decisión merece una pausa.
// La contraseña es la confirmación; una cuenta creada con Spotify no tiene, así que escribe la palabra y
// se reconfirma en Spotify (el back exige un grant nuevo de la cuenta vinculada).
export function DeleteAccountScreen() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const user = useUser()
  const me = useMeQuery()
  const { deleteAccount } = useSession()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const hasPassword = me.data?.hasPassword ?? true
  const ready = hasPassword ? password.length > 0 : isDeleteConfirmation(confirmation)

  const remove = useMutation({
    mutationFn: async () => {
      const body: DeleteMeRequest = hasPassword
        ? { password }
        : { spotify: await authorizeSpotifyGrant(user.id) }
      await deleteAccount(body)
    },
    // Al terminar la sesión pasa a signedOut y el layout raíz lleva solo al inicio; el toast sobrevive al cambio.
    onSuccess: () => toast.show('Borramos tu cuenta y tus datos.', 'success'),
    onError: (error) => {
      const { password: wrong, general } = deleteAccountError(error)
      if (wrong || general) haptics.warning()
    },
  })

  const failure = remove.isError ? deleteAccountError(remove.error) : null

  if (me.isPending || me.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Borrar cuenta' }} />
        {me.isPending ? (
          <LoadingState label="Cargando tu cuenta" />
        ) : (
          <ErrorState message="No pudimos cargar tu cuenta." onRetry={() => void me.refetch()} retrying={me.isRefetching} />
        )}
      </Screen>
    )
  }

  return (
    <Screen
      mode="form"
      edges={[]}
      footer={
        <>
          <Button
            label={hasPassword ? 'Borrar mi cuenta' : 'Confirmar con Spotify y borrar'}
            variant="destructive"
            size="lg"
            disabled={!ready}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
            accessibilityHint={
              ready ? undefined : hasPassword ? 'Escribe tu contraseña para habilitarlo' : `Escribe ${DELETE_CONFIRMATION_WORD} para habilitarlo`
            }
          />
          <Button label="Cancelar" variant="ghost" disabled={remove.isPending} onPress={() => router.back()} />
        </>
      }
    >
      <Stack.Screen options={{ title: 'Borrar cuenta' }} />
      <View style={styles.page}>
        <View style={styles.head}>
          <Icon icon={WarningIcon} size={32} color="danger" />
          <Text variant="title2" accessibilityRole="header">
            Esto borra tu cuenta para siempre
          </Text>
        </View>

        <View style={styles.block}>
          <Text variant="headline">Qué se borra</Text>
          <Text variant="body" color="textMuted">
            {DELETE_ACCOUNT_SCOPE}
          </Text>
        </View>

        <View style={styles.block}>
          <Text variant="headline">Antes de seguir</Text>
          <Text variant="body" color="textMuted">
            Si quieres una copia de tu información, descárgala primero desde Tú, en Descargar mis datos. Las personas con
            las que tenías match dejan de verte.
          </Text>
        </View>

        {hasPassword ? (
          <PasswordField
            label="Tu contraseña"
            helper="La pedimos para confirmar que eres tú."
            value={password}
            onChangeText={(text) => {
              if (remove.isError) remove.reset()
              setPassword(text)
            }}
            autoComplete="current-password"
            textContentType="password"
            editable={!remove.isPending}
            returnKeyType="done"
            error={failure?.password ?? null}
          />
        ) : (
          <TextField
            label={`Escribe ${DELETE_CONFIRMATION_WORD} para confirmar`}
            helper="Luego confirmas en Spotify, con la cuenta con la que entras a Encorely."
            value={confirmation}
            onChangeText={(text) => {
              if (remove.isError) remove.reset()
              setConfirmation(text)
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            editable={!remove.isPending}
            returnKeyType="done"
          />
        )}

        {failure?.general ? <Alert message={failure.general} /> : null}
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xl },
    head: { gap: space.md },
    block: { gap: space.xs },
  })
