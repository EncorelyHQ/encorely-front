import { createContext, useContext, type ReactNode } from 'react'
import { makeMutable, type SharedValue } from 'react-native-reanimated'

export type ScreenScroll = {
  // Desplazamiento vertical del Screen, en el hilo de UI.
  y: SharedValue<number>
  // Borde inferior de lo visible del scroll, en coordenadas de ventana (para comparar con `measure().pageY`).
  viewportBottom: SharedValue<number>
}

const ScreenScrollContext = createContext<ScreenScroll | null>(null)

export function ScreenScrollProvider({ value, children }: { value: ScreenScroll; children: ReactNode }) {
  return <ScreenScrollContext.Provider value={value}>{children}</ScreenScrollContext.Provider>
}

// Fuera de un Screen con scroll las piezas se muestran quietas y completas: nada que revelar.
const still: ScreenScroll = { y: makeMutable(0), viewportBottom: makeMutable(Number.MAX_SAFE_INTEGER) }

export function useScreenScroll(): ScreenScroll {
  return useContext(ScreenScrollContext) ?? still
}
