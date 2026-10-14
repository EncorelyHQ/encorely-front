import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as WebBrowser from 'expo-web-browser'
import { authorizeSpotifyLogin, SpotifyButton } from '@/features/spotify'
import { toSpotifyLoginRequest } from '../lib/spotify'
import { authApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { useSession } from '@/lib/session/SessionContext'
import { Alert, Checkbox, haptics, Sheet, space, Text, useStyles, useTheme, useToast } from '@/ui'
import { spotifySignInError } from '../lib/errors'
import { CONSENT_LABEL, consentVersionOf, legalLinksOf } from '../lib/legal'
import { TextLink } from './TextLink'

// Entrar y registrarse con Spotify es el mismo botón: el back decide si la cuenta existe.
// El consentimiento se pide antes de abrir Spotify porque el code es de un solo uso y no se puede volver a pedir.
export function SpotifySignIn() {
  const styles = useStyles(makeStyles)
  const theme = useTheme()
  const toast = useToast()
  const { signInWithSpotify } = useSession()
  const [open, setOpen] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const legal = useQuery({ queryKey: queryKeys.legal, queryFn: authApi.legal, enabled: open })
  const consentVersion = consentVersionOf(legal.data)
  const links = legalLinksOf(legal.data)

  const signIn = useMutation({
    mutationFn: async () => {
      const grant = await authorizeSpotifyLogin(consentVersion)
      await signInWithSpotify(toSpotifyLoginRequest(grant))
    },
    onError: (error) => {
      const text = spotifySignInError(error)
      if (text) haptics.warning()
      setMessage(text)
    },
  })

  const submit = () => {
    if (signIn.isPending) return
    if (!accepted) {
      haptics.warning()
      setConsentError('Para continuar, acepta los términos.')
      return
    }
    if (!consentVersion) {
      void legal.refetch()
      return
    }
    setMessage(null)
    signIn.mutate()
  }

  const openLegal = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, { controlsColor: theme.accent, toolbarColor: theme.bg })
    } catch (error) {
      toast.show(userMessage(error), 'danger')
    }
  }

  return (
    <>
      <SpotifyButton
        label="Continuar con Spotify"
        busyLabel="Esperando a Spotify"
        busy={false}
        size="lg"
        onPress={() => setOpen(true)}
      />

      <Sheet visible={open} onClose={() => !signIn.isPending && setOpen(false)} title="Continuar con Spotify">
        <View style={styles.body}>
          <Text variant="body" color="textMuted">
            Si ya entraste antes con Spotify, vuelves a tu cuenta. Si es la primera vez, la creamos con tu nombre y tu
            correo de Spotify.
          </Text>
          <Checkbox
            checked={accepted}
            onChange={(value) => {
              setAccepted(value)
              setConsentError(null)
            }}
            label={CONSENT_LABEL}
            error={consentError ?? undefined}
            disabled={signIn.isPending}
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
            <Alert message="No pudimos cargar los términos. Sin ellos no podemos continuar." />
          ) : null}
          {message ? <Alert message={message} /> : null}
          <SpotifyButton
            label="Continuar con Spotify"
            busyLabel="Esperando a Spotify"
            busy={signIn.isPending}
            size="lg"
            onPress={submit}
          />
        </View>
      </Sheet>
    </>
  )
}

const makeStyles = () =>
  StyleSheet.create({
    body: { gap: space.lg },
    links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  })
