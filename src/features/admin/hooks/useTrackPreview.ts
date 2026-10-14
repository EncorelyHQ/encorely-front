import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

let audioModeReady: Promise<void> | null = null

// Mismo modo que Descubrir: respeta el silencio del teléfono y no suena en segundo plano.
function ensureAudioMode(): Promise<void> {
  audioModeReady ??= setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  }).catch((error: unknown) => {
    audioModeReady = null
    throw error
  })
  return audioModeReady
}

export type TrackPreview = {
  playingId: string | null
  loadingId: string | null
  toggle: (id: string, url: string) => void
  stop: () => void
}

// Si la vista previa no arranca en este tiempo, se suelta: nada de spinners eternos.
const LOAD_TIMEOUT_MS = 10_000

// Un solo reproductor por pantalla: tocar otra canción corta la anterior. Se calla al salir o al ir a segundo plano.
export function useTrackPreview(onError?: () => void): TrackPreview {
  const playerRef = useRef<{ id: string; player: AudioPlayer; remove: () => void } | null>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const stop = useCallback(() => {
    const current = playerRef.current
    playerRef.current = null
    current?.remove()
    setPlayingId(null)
    setLoadingId(null)
  }, [])

  const toggle = useCallback(
    (id: string, url: string) => {
      const current = playerRef.current
      if (current?.id === id) {
        if (current.player.playing) {
          current.player.pause()
          setPlayingId(null)
        } else {
          current.player.play()
          setPlayingId(id)
        }
        return
      }
      stop()
      let player: AudioPlayer
      try {
        player = createAudioPlayer({ uri: url }, { updateInterval: 500 })
      } catch (error) {
        console.warn('[admin] No se pudo crear el reproductor de la vista previa', error)
        return
      }
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (playerRef.current?.player !== player) return
        if (status.didJustFinish) {
          setPlayingId(null)
          player.seekTo(0).catch((error: unknown) => console.warn('[admin] No se pudo reiniciar la vista previa', error))
          return
        }
        if (status.playing) {
          clearTimeout(timeout)
          setLoadingId(null)
          setPlayingId(id)
        }
      })
      const timeout = setTimeout(() => {
        if (playerRef.current?.player !== player || player.playing) return
        stop()
        onErrorRef.current?.()
      }, LOAD_TIMEOUT_MS)
      playerRef.current = {
        id,
        player,
        remove: () => {
          clearTimeout(timeout)
          subscription.remove()
          player.pause()
          player.remove()
        },
      }
      setLoadingId(id)
      ensureAudioMode()
        .then(() => {
          if (playerRef.current?.player === player) player.play()
        })
        .catch((error: unknown) => {
          // Sin modo de audio no sabemos si respetaría el silencio: preferimos no sonar.
          console.warn('[admin] No se pudo configurar el audio de la vista previa', error)
          if (playerRef.current?.player === player) {
            stop()
            onErrorRef.current?.()
          }
        })
    },
    [stop],
  )

  // Al salir de la pantalla (otra encima o atrás) se calla.
  useFocusEffect(useCallback(() => stop, [stop]))

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop()
    })
    return () => {
      sub.remove()
      playerRef.current?.remove()
      playerRef.current = null
    }
  }, [stop])

  return { playingId, loadingId, toggle, stop }
}
