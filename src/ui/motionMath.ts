// Matemática del motion ligado al scroll, en worklets puros para probarla sin Reanimated.
// Valores tomados del prototipo (reportes/09-prototipo-perfil-stickers.html).

export const clamp01 = (value: number) => {
  'worklet'
  return Math.min(1, Math.max(0, value))
}

// 0 = la sección asoma por abajo; 1 = ya entró 240 pt dentro de lo visible.
export const REVEAL_DISTANCE = 240
const REVEAL_LEAD = 24

export function revealProgress(viewportBottom: number, top: number) {
  'worklet'
  return clamp01((viewportBottom - top - REVEAL_LEAD) / REVEAL_DISTANCE)
}

export const REVEAL = { tiltDeg: 14, shiftY: 28, minOpacity: 0.35 } as const

// La boleta se inclina hacia atrás en los primeros 260 pt de scroll.
export const PARALLAX = { distance: 260, tiltDeg: 12, minScale: 0.92, fade: 0.55 } as const

export function parallaxProgress(scrollY: number) {
  'worklet'
  return clamp01(scrollY / PARALLAX.distance)
}

export const CAROUSEL = { tiltDeg: 18, shrink: 0.06 } as const

// -1 = una mitad de pantalla a la izquierda del centro, 1 = a la derecha.
export function carouselOffset(itemCenter: number, scrollX: number, viewportWidth: number) {
  'worklet'
  const half = viewportWidth / 2 || 1
  return Math.min(1, Math.max(-1, (itemCenter - (scrollX + half)) / half))
}

// Con la fuente del sistema al 150 % o más, inclinar un texto ya enorme lo vuelve difícil de leer.
export const LARGE_FONT_SCALE = 1.5
export const LARGE_FONT_MAX_TILT = 1

export function stickerAngle(angle: number, fontScale: number) {
  if (fontScale < LARGE_FONT_SCALE) return angle
  return Math.max(-LARGE_FONT_MAX_TILT, Math.min(LARGE_FONT_MAX_TILT, angle))
}
