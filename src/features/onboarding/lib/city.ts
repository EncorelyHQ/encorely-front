// Ciudades con conciertos cargados en v1; el back filtra eventos por este texto exacto.
export const CITY_OPTIONS = ['Bogotá', 'Medellín'] as const
export type KnownCity = (typeof CITY_OPTIONS)[number]
export type CityChoice = KnownCity | 'other'

export const CITY_MIN = 2
export const CITY_MAX = 80

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

// Lleva una ciudad guardada (p. ej. "bogota" o "Bogotá D.C.") a la opción que la representa.
export function cityChoiceFor(city: string | null | undefined): { choice: CityChoice | null; other: string } {
  const value = city?.trim() ?? ''
  if (!value) return { choice: null, other: '' }
  const folded = fold(value)
  const known = CITY_OPTIONS.find((option) => folded === fold(option) || folded.startsWith(`${fold(option)} `))
  return known ? { choice: known, other: '' } : { choice: 'other', other: value }
}

export function resolveCity(choice: CityChoice | null, other: string): string | null {
  if (!choice) return null
  if (choice !== 'other') return choice
  const value = other.trim().replace(/\s+/g, ' ')
  return value || null
}

export function cityError(choice: CityChoice | null, other: string): string | null {
  if (!choice) return 'Elige tu ciudad.'
  if (choice !== 'other') return null
  const value = resolveCity(choice, other)
  if (!value) return 'Escribe tu ciudad.'
  if (value.length < CITY_MIN) return 'Escribe el nombre completo de la ciudad.'
  if (value.length > CITY_MAX) return `Usa máximo ${CITY_MAX} caracteres.`
  return null
}
