// Reglas de perfil compartidas por registro, onboarding y edición de perfil. Los límites replican
// UpdateMeRequest del back para que el error salga antes del viaje; el back sigue mandando.

export const MIN_AGE = 18
// Tope de plausibilidad: atrapa años mal tecleados (1890, 0199) sin juzgar a nadie real.
export const MAX_AGE = 120
export const NAME_MIN = 2
export const NAME_MAX = 50
export const CITY_MIN = 2
export const CITY_MAX = 80
export const BIO_MAX = 160

export type CalendarDate = { year: number; month: number; day: number }
export type BirthDateParts = { day: string; month: string; year: string }

export type BirthDateFailure =
  | 'empty'
  | 'incomplete'
  | 'not_numeric'
  | 'year_length'
  | 'month'
  | 'day'
  | 'future'
  | 'underage'
  | 'implausible'

export type BirthDateResult = { ok: true; iso: string; age: number } | { ok: false; reason: BirthDateFailure; message: string }

// --- Calendario ---

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function isValidDate({ year, month, day }: CalendarDate): boolean {
  if (![year, month, day].every(Number.isInteger)) return false
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month)
}

// Fecha local del dispositivo: la edad se cuenta con el calendario de la persona, no en UTC.
export function todayParts(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

// Misma regla que el back (.NET: birth > today.AddYears(-age) ⇒ age--): quien nació un 29 de febrero
// cumple el 1 de marzo en años no bisiestos.
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  let age = today.year - birth.year
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1
  return age
}

const pad = (value: number, size: number) => String(value).padStart(size, '0')

export function formatIsoDate({ year, month, day }: CalendarDate): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

export function parseIsoDate(value: string | null | undefined): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return isValidDate(parts) ? parts : null
}

// Para prellenar los campos: sin ceros a la izquierda y tolerante a fechas con hora.
export function splitIsoDate(iso: string | null | undefined): BirthDateParts {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  if (!match) return { day: '', month: '', year: '' }
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
}

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '')
}

const fail = (reason: BirthDateFailure, message: string): BirthDateResult => ({ ok: false, reason, message })

export function validateBirthDate(parts: BirthDateParts, today: CalendarDate = todayParts()): BirthDateResult {
  const day = parts.day.trim()
  const month = parts.month.trim()
  const year = parts.year.trim()

  if (!day && !month && !year) return fail('empty', 'Escribe tu fecha de nacimiento.')
  if (!day || !month || !year) return fail('incomplete', 'Completa el día, el mes y el año.')
  if (!/^\d+$/.test(day) || !/^\d+$/.test(month) || !/^\d+$/.test(year)) {
    return fail('not_numeric', 'Usa solo números en la fecha.')
  }
  if (year.length !== 4) return fail('year_length', 'Escribe el año con cuatro cifras.')

  const date: CalendarDate = { year: Number(year), month: Number(month), day: Number(day) }
  if (date.month < 1 || date.month > 12) return fail('month', 'El mes va de 1 a 12.')
  const maxDay = daysInMonth(date.year, date.month)
  if (date.day < 1 || date.day > maxDay) return fail('day', `Ese mes tiene ${maxDay} días. Revisa el día.`)

  const age = ageOn(date, today)
  if (age < 0) return fail('future', 'Esa fecha todavía no ha llegado. Revísala.')
  if (age < MIN_AGE) return fail('underage', UNDERAGE_MESSAGE)
  if (age > MAX_AGE) return fail('implausible', 'Revisa el año: parece que tiene un error.')

  return { ok: true, iso: formatIsoDate(date), age }
}

export const UNDERAGE_MESSAGE = `Necesitas tener ${MIN_AGE} años o más para usar Encorely.`

// --- Texto ---

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
  if (length < CITY_MIN) return 'Escribe el nombre completo de tu ciudad.'
  if (length > CITY_MAX) return `El nombre de la ciudad puede tener hasta ${CITY_MAX} caracteres.`
  return null
}

export function validateBio(value: string): string | null {
  if (charCount(value.trim()) > BIO_MAX) return `Puedes escribir hasta ${BIO_MAX} caracteres.`
  return null
}

// --- Ciudad como opción cerrada + "otra" ---

// Ciudades con conciertos cargados en v1; el back filtra eventos por este texto exacto.
export const CITY_OPTIONS = ['Bogotá', 'Medellín'] as const
export type KnownCity = (typeof CITY_OPTIONS)[number]
export type CityChoice = KnownCity | 'other'

export const CITY_CHOICES: readonly { value: CityChoice; label: string }[] = [
  ...CITY_OPTIONS.map((city) => ({ value: city, label: city })),
  { value: 'other', label: 'Otra' },
]

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
  if (!value) return 'Escribe el nombre de tu ciudad.'
  return validateCity(value)
}
