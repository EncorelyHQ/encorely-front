import { useEffect, useState } from 'react'
import { AccessibilityInfo, AppState } from 'react-native'

export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'))
    return () => sub.remove()
  }, [])
  return active
}

// Con TalkBack/VoiceOver el autoplay taparía la voz que lee la pantalla.
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setEnabled(value)
      })
      .catch((error: unknown) => console.warn('[discover] No se pudo leer el estado del lector de pantalla', error))
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled)
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])
  return enabled
}
