import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { spotifyLinkError } from '@/features/auth'
import { authorizeSpotifyGrant } from '@/features/spotify'
import { meApi } from '@/lib/api/endpoints'
import type { Me } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useUser } from '@/lib/session/SessionContext'
import { ConfirmSheet, haptics, ListRow, SpotifyLogoIcon, useTheme, useToast } from '@/ui'

// Vincular Spotify a la cuenta para entrar con él. No es lo mismo que importar artistas (la tarjeta de arriba):
// esto vive en el back y sirve en cualquier teléfono; la importación guarda un acceso solo en este.
export function SpotifyLinkRow({ me }: { me: Me | undefined }) {
  const theme = useTheme()
  const toast = useToast()
  const user = useUser()
  const queryClient = useQueryClient()
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  const refreshMe = () => queryClient.invalidateQueries({ queryKey: queryKeys.me, exact: true })
  const fail = (error: unknown) => {
    const message = spotifyLinkError(error)
    if (!message) return
    haptics.warning()
    toast.show(message, 'danger')
  }

  const link = useMutation({
    mutationFn: async () => meApi.linkSpotify(await authorizeSpotifyGrant(user.id)),
    onSuccess: async () => {
      await refreshMe()
      toast.show('Vinculamos tu Spotify. Ya puedes entrar con él.', 'success')
    },
    onError: fail,
  })

  const unlink = useMutation({
    mutationFn: meApi.unlinkSpotify,
    onSuccess: async () => {
      setConfirmUnlink(false)
      await refreshMe()
      toast.show('Desvinculamos tu Spotify.')
    },
    onError: (error) => {
      setConfirmUnlink(false)
      fail(error)
    },
  })

  if (!me) return null
  const busy = link.isPending || unlink.isPending
  // Sin contraseña, Spotify es la única forma de entrar: el back respondería 409 spotify_last_login_method.
  const locked = me.spotifyLinked && !me.hasPassword

  return (
    <>
      <ListRow
        title="Entrar con Spotify"
        subtitle={
          !me.spotifyLinked
            ? 'Vincúlalo para entrar sin contraseña.'
            : locked
              ? 'Vinculado. Es tu forma de entrar a Encorely.'
              : 'Vinculado. Toca para desvincularlo.'
        }
        icon={SpotifyLogoIcon}
        chevron={!busy && !locked}
        trailing={busy ? <ActivityIndicator color={theme.textMuted} /> : undefined}
        onPress={
          locked || busy ? undefined : me.spotifyLinked ? () => setConfirmUnlink(true) : () => link.mutate()
        }
      />
      <ConfirmSheet
        visible={confirmUnlink}
        title="¿Desvincular Spotify?"
        message="Vas a entrar solo con tu correo y tu contraseña. Puedes volver a vincularlo cuando quieras."
        confirmLabel="Desvincular"
        destructive
        loading={unlink.isPending}
        onConfirm={() => unlink.mutate()}
        onCancel={() => {
          if (!unlink.isPending) setConfirmUnlink(false)
        }}
      />
    </>
  )
}
