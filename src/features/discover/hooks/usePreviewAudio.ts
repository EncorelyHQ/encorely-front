import { useCallback, useEffect, useRef, useState } from 'react'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

let audioModeReady: Promise<void> | null = null

// Se configura una sola vez por proceso. Si falla no se memoriza, para reintentar en el siguiente play.
function ensureAudioMode(): Promise<void> {
  audioModeReady ??= setAudioModeAsync({
    // Respeta el modo silencio: en clase o en un concierto, abrir la app no hace sonar nada.
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    // La vista previa es el contenido de la pantalla: pausa la música de otras apps en vez de mezclarse.
    interruptionMode: 'doNotMix',
  }).catch((error: unknown) => {
    audioModeReady = null
    throw error
  })
  return audioModeReady
}

// Solo para tests: el modo de audio es estado de módulo.
export function resetAudioModeForTests() {
  audioModeReady = null
}

type Options = {
  // Pantalla enfocada y app en primer plano. Si pasa a false, se pausa.
  active: boolean
  // Arranca solo al llegar la tarjeta (se apaga con lector de pantalla para no pisar la voz).
  autoplay: boolean
}

export type PreviewAudio = {
  available: boolean
  isPlaying: boolean
  // 0..1 en un shared value: el progreso cada 250 ms no re-renderiza el árbol de React.
  progress: SharedValue<number>
  toggle: () => void
}

type Track = { id: string; previewUrl: string | null }

export function usePreviewAudio(track: Track | null | undefined, { active, autoplay }: Options): PreviewAudio {
  const trackId = track?.id ?? null
  const previewUrl = track?.previewUrl ?? null
  const playerRef = useRef<AudioPlayer | null>(null)
  const userPausedRef = useRef(false)
  const finishedRef = useRef(false)
  const activeRef = useRef(active)
  // Estado atado a la canción: al cambiar de tarjeta deja de valer solo, sin resetearlo dentro de un efecto.
  const [playback, setPlayback] = useState<{ trackId: string; playing: boolean } | null>(null)
  const progress = useSharedValue(0)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const play = useCallback((player: AudioPlayer) => {
    ensureAudioMode()
      .then(() => {
        // Entre la promesa y aquí pudo cambiar la tarjeta o perderse el foco.
        if (playerRef.current === player && activeRef.current) player.play()
      })
      .catch((error: unknown) => {
        // Sin modo de audio no sabemos si respetaría el silencio: preferimos no sonar.
        console.warn('[discover] No se pudo configurar el audio de la vista previa', error)
      })
  }, [])

  // Un player por canción: se crea al llegar la tarjeta y se libera al cambiarla o desmontar (sin sonidos huérfanos).
  useEffect(() => {
    userPausedRef.current = false
    finishedRef.current = false
    progress.set(0)
    if (!trackId || !previewUrl) return

    let player: AudioPlayer
    try {
      player = createAudioPlayer({ uri: previewUrl }, { updateInterval: 250 })
    } catch (error) {
      console.warn('[discover] No se pudo crear el reproductor de la vista previa', error)
      return
    }
    playerRef.current = player

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (playerRef.current !== player) return
      if (status.didJustFinish) {
        finishedRef.current = true
        progress.set(1)
      } else if (status.duration > 0) {
        progress.set(Math.min(1, status.currentTime / status.duration))
      }
      // Devolver el mismo objeto hace que React descarte el render: solo re-renderiza al alternar play/pausa.
      const playing = status.playing && !status.didJustFinish
      setPlayback((prev) => (prev?.trackId === trackId && prev.playing === playing ? prev : { trackId, playing }))
    })

    return () => {
      subscription.remove()
      if (playerRef.current === player) playerRef.current = null
      player.pause()
      player.remove()
    }
  }, [trackId, previewUrl, progress])

  // Foco y app activa: arranca (si toca) o pausa. Va después del efecto que crea el player.
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (!active) {
      player.pause()
      return
    }
    if (autoplay && !userPausedRef.current && !finishedRef.current) play(player)
  }, [active, autoplay, trackId, previewUrl, play])

  const toggle = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.playing) {
      userPausedRef.current = true
      player.pause()
      return
    }
    userPausedRef.current = false
    if (finishedRef.current) {
      finishedRef.current = false
      progress.set(0)
      player.seekTo(0).catch((error: unknown) => console.warn('[discover] No se pudo reiniciar la vista previa', error))
    }
    play(player)
  }, [play, progress])

  const isPlaying = !!trackId && playback?.trackId === trackId && playback.playing
  return { available: !!previewUrl, isPlaying, progress, toggle }
}
