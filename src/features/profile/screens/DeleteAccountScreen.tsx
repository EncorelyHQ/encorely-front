import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { userMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/session/SessionContext'
import { Button, Icon, Screen, space, Text, TextField, useStyles, useToast, WarningIcon, type Theme } from '@/ui'
import { DELETE_CONFIRMATION_WORD, isDeleteConfirmation } from '../validation'

export const DELETE_ACCOUNT_SCOPE = 'Tu perfil, tus calificaciones, tus matches y todos tus mensajes. No se puede deshacer.'

// Pantalla y no hoja: escribir la palabra con el teclado abierto necesita espacio, y la decisión merece una pausa.
export function DeleteAccountScreen() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { deleteAccount } = useSession()
  const [confirmation, setConfirmation] = useState('')
  const ready = isDeleteConfirmation(confirmation)

  const remove = useMutation({
    mutationFn: deleteAccount,
    // Al terminar la sesión pasa a signedOut y el layout raíz lleva solo al inicio; el toast sobrevive al cambio.
    onSuccess: () => toast.show('Borramos tu cuenta y tus datos.', 'success'),
  })

  return (
    <Screen
      mode="form"
      edges={[]}
      footer={
        <>
          <Button
            label="Borrar mi cuenta"
            variant="destructive"
            size="lg"
            disabled={!ready}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
            accessibilityHint={ready ? undefined : `Escribe ${DELETE_CONFIRMATION_WORD} para habilitarlo`}
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

        <TextField
          label={`Escribe ${DELETE_CONFIRMATION_WORD} para confirmar`}
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
          error={remove.isError ? userMessage(remove.error) : null}
        />
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
