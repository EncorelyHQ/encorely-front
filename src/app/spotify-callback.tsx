import { useEffect, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { toSpotifyLoginRequest } from '@/features/auth/lib/spotify'
import { completeLoginRedirect, useSpotifyImport } from '@/features/spotify'
import { useSession } from '@/lib/session/SessionContext'
import { LoadingState, Screen } from '@/ui'

// Si Android mató la app mientras la persona estaba en Spotify, el redirect llega aquí en frío y se reanuda:
// sin sesión era un login con Spotify; con sesión, la importación de artistas desde "Tú".
// Con la app viva, openAuthSessionAsync ya lo resolvió y aquí no hay nada pendiente.
export default function SpotifyCallback() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>()
  const { status: session, signInWithSpotify } = useSession()
  const { resume, status } = useSpotifyImport()
  const started = useRef(false)

  useEffect(() => {
    if (started.current || session === 'loading') return
    started.current = true
    const authorization = { code: params.code, state: params.state, error: params.error }
    if (session === 'signedIn') {
      resume(authorization)
      return
    }
    void (async () => {
      const grant = await completeLoginRedirect(authorization).catch(() => null)
      if (grant) await signInWithSpotify(toSpotifyLoginRequest(grant)).catch(() => undefined)
      // Si no entró, vuelve a la bienvenida: ahí puede intentarlo otra vez con el error a la vista.
      router.replace('/')
    })()
  }, [params.code, params.error, params.state, resume, session, signInWithSpotify])

  useEffect(() => {
    if (session !== 'signedIn' || !started.current) return
    if (status === 'authorizing' || status === 'importing') return
    if (router.canGoBack()) router.back()
    else router.replace('/me')
  }, [session, status])

  return (
    <Screen>
      <LoadingState label="Volviendo de Spotify" />
    </Screen>
  )
}
