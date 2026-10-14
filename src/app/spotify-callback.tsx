import { useEffect, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { useSession } from '@/lib/session/SessionContext'
import { useSpotifyImport } from '@/features/spotify'
import { LoadingState, Screen } from '@/ui'

// Si Android mató la app mientras la persona estaba en Spotify, el redirect llega aquí en frío:
// se reanuda el canje (de un solo uso) y se vuelve a "Tú". Con la app viva, openAuthSessionAsync ya lo resolvió.
export default function SpotifyCallback() {
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>()
  const { status: session } = useSession()
  const { resume, status } = useSpotifyImport()
  const started = useRef(false)

  useEffect(() => {
    if (started.current || session !== 'signedIn') return
    started.current = true
    resume({ code: params.code, state: params.state, error: params.error })
  }, [params.code, params.error, params.state, resume, session])

  useEffect(() => {
    if (session !== 'signedIn') {
      if (session === 'signedOut') router.replace('/')
      return
    }
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
