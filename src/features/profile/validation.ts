// Validaciones propias del perfil. Las de fecha, nombre, ciudad y bio viven en features/shared/profileRules.

export const GENRES_MIN = 1
export const GENRES_MAX = 10

export function validateGenres(slugs: readonly string[]): string | null {
  if (slugs.length < GENRES_MIN) return 'Elige al menos un género.'
  if (slugs.length > GENRES_MAX) return `Puedes elegir hasta ${GENRES_MAX} géneros.`
  return null
}

export const DELETE_CONFIRMATION_WORD = 'BORRAR'

export function isDeleteConfirmation(value: string): boolean {
  return value.trim().toUpperCase() === DELETE_CONFIRMATION_WORD
}
