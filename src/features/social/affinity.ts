// "Gustos en común" en vez de "afinidad": el número sale de un coseno entre pesos de géneros y no merece
// más precisión que la que tiene. Se redondea de 5 en 5 y, sin señal suficiente, el back manda null y no se muestra.
export const AFFINITY_STEP = 5
// Espejo de AFFINITY_MIN_SWIPES del back (draft.11). Solo se usa en el texto que explica el cálculo.
export const AFFINITY_MIN_SONGS = 25

export function roundAffinity(affinity: number): number {
  return Math.min(100, Math.max(0, Math.round(affinity / AFFINITY_STEP) * AFFINITY_STEP))
}

// Espacio no separable: "80 %" nunca se parte en dos líneas.
export const affinityPercent = (affinity: number) => `${roundAffinity(affinity)} %`

export function affinitySentence(affinity: number | null): string | null {
  return affinity === null ? null : `${affinityPercent(affinity)} de gustos en común`
}

export const AFFINITY_EXPLAINER = [
  'Comparamos los géneros que le gustan a cada uno: los que calificaron con «Me gusta» en Descubrir, los que eligieron en su perfil y los de Spotify si lo conectaron.',
  'Lo redondeamos de 5 en 5 porque es una guía, no una nota exacta. Con más canciones calificadas, el porcentaje se afina.',
  `Si alguno de los dos todavía no califica ${AFFINITY_MIN_SONGS} canciones ni conecta Spotify, no mostramos porcentaje: solo lo que tienen en común.`,
] as const
