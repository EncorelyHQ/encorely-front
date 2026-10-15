import { ReduceMotion, useReducedMotion } from 'react-native-reanimated'

// Único lugar que decide si hay movimiento. Las piezas nuevas lo usan; las animaciones de layout pasan
// `reduceMotion` a Reanimated para que el sistema las apague igual.
export function useMotion() {
  const reduced = useReducedMotion()
  return { reduced, reduceMotion: ReduceMotion.System } as const
}
