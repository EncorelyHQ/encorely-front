// Validaciones puras del perfil. Los límites replican UpdateMeRequest del back para que el error salga antes del viaje.
// Onboarding tiene reglas parecidas: se unificarán en un módulo común más adelante.

export const MIN_AGE = 18
export const MAX_AGE = 120
export const NAME_MIN = 2
export const NAME_MAX = 50
export const CITY_MIN = 2
export const CITY_MAX = 80
export const BIO_MAX = 160
export const GENRES_MIN = 1
export const GENRES_MAX = 10

export type BirthDateParts = { day: string; month: string; year: string }
export type CalendarDate = { year: number; month: number; day: number }

export type BirthDateResult = { ok: true; iso: string; age: number } | { ok: false; error: string }

export function todayLocal(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

export function daysInMonth(year: number, month: number): number {
  // El día 0 del mes siguiente es el último del mes pedido; Date resuelve bisiestos.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

// Igual que User.AgeOn del back: cumple años el mismo día y mes (29 feb cumple el 1 mar en años no bisiestos).
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  let age = today.year - birth.year
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age--
  return age
}

const pad = (value: number, length: number) => String(value).padStart(length, '0')

export function toIsoDate(date: CalendarDate): string {
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`
}

export function splitIsoDate(iso: string | null | undefined): BirthDateParts {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  if (!match) return { day: '', month: '', year: '' }
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
}

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '')
}

export function parseBirthDate(parts: BirthDateParts, today: CalendarDate = todayLocal()): BirthDateResult {
  const day = parts.day.trim()
  const month = parts.month.trim()
  const year = parts.year.trim()

  if (!day && !month && !year) return { ok: false, error: 'Escribe tu fecha de nacimiento.' }
  if (!day || !month || !year) return { ok: false, error: 'Completa el día, el mes y el año.' }
  if (!/^\d+$/.test(day) || !/^\d+$/.test(month) || !/^\d+$/.test(year)) {
    return { ok: false, error: 'Usa solo números en la fecha.' }
  }
  if (year.length !== 4) return { ok: false, error: 'Escribe el año con cuatro cifras.' }

  const date: CalendarDate = { year: Number(year), month: Number(month), day: Number(day) }
  if (date.month < 1 || date.month > 12) return { ok: false, error: 'El mes va de 1 a 12.' }
  const maxDay = daysInMonth(date.year, date.month)
  if (date.day < 1 || date.day > maxDay) return { ok: false, error: `Ese mes tiene ${maxDay} días. Revisa el día.` }

  const age = ageOn(date, today)
  if (age < 0) return { ok: false, error: 'Esa fecha todavía no ha llegado. Revísala.' }
  if (age < MIN_AGE) return { ok: false, error: `Necesitas tener ${MIN_AGE} años o más para usar Encorely.` }
  if (age > MAX_AGE) return { ok: false, error: 'Revisa el año: parece que tiene un error.' }

  return { ok: true, iso: toIsoDate(date), age }
}

// Cuenta caracteres visibles (un emoji es uno), que es lo que la persona ve en el contador.
export function charCount(value: string): number {
  return Array.from(value).length
}

export function validateDisplayName(value: string): string | null {
  const length = charCount(value.trim())
  if (length === 0) return 'Escribe tu nombre.'
  if (length < NAME_MIN) return `Tu nombre necesita al menos ${NAME_MIN} letras.`
  if (length > NAME_MAX) return `Tu nombre puede tener hasta ${NAME_MAX} caracteres.`
  return null
}

export function validateCity(value: string): string | null {
  const length = charCount(value.trim())
  if (length === 0) return 'Elige tu ciudad.'
  if (length < CITY_MIN) return `Escribe el nombre completo de tu ciudad.`
  if (length > CITY_MAX) return `El nombre de la ciudad puede tener hasta ${CITY_MAX} caracteres.`
  return null
}

export function validateBio(value: string): string | null {
  if (charCount(value.trim()) > BIO_MAX) return `Puedes escribir hasta ${BIO_MAX} caracteres.`
  return null
}

export function validateGenres(slugs: readonly string[]): string | null {
  if (slugs.length < GENRES_MIN) return 'Elige al menos un género.'
  if (slugs.length > GENRES_MAX) return `Puedes elegir hasta ${GENRES_MAX} géneros.`
  return null
}

export const DELETE_CONFIRMATION_WORD = 'BORRAR'

export function isDeleteConfirmation(value: string): boolean {
  return value.trim().toUpperCase() === DELETE_CONFIRMATION_WORD
}
