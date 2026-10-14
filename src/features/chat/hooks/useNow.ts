import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

// Referencia de "ahora" para etiquetas relativas (Hoy, Ayer). Se fija al montar y al volver a la app,
// no en cada render: así las etiquetas no cambian mientras se hace scroll.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now())
    })
    return () => sub.remove()
  }, [])
  return now
}
