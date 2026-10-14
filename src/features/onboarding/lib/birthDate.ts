export const MIN_AGE = 18
// Tope de plausibilidad: atrapa años mal tecleados (1890, 0199) sin juzgar a nadie real.
const MAX_AGE = 120

export type DateParts = { year: number; month: number; day: number }

export type BirthDateResult =
  | { ok: true; iso: string; age: number }
  | { ok: false; reason: 'incomplete' | 'invalid' | 'future' | 'underage' | 'implausible' }

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function isValidDate({ year, month, day }: DateParts): boolean {
  if (![year, month, day].every(Number.isInteger)) return false
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month)
}

const pad = (value: number, size: number) => String(value).padStart(size, '0')

export function formatIsoDate({ year, month, day }: DateParts): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

export function parseIsoDate(value: string | null | undefined): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return isValidDate(parts) ? parts : null
}

// Fecha local del dispositivo: la edad se cuenta con el calendario de la persona, no en UTC.
export function todayParts(now: Date = new Date()): DateParts {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

function compare(a: DateParts, b: DateParts): number {
  return a.year - b.year || a.month - b.month || a.day - b.day
}

// Misma regla que el back (.NET: birth > today.AddYears(-age) ⇒ age--): quien nació un 29 de febrero
// cumple el 1 de marzo en años no bisiestos.
export function ageOn(birth: DateParts, today: DateParts): number {
  let age = today.year - birth.year
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1
  return age
}

const onlyDigits = (value: string) => /^\d+$/.test(value)

export function validateBirthDate(day: string, month: string, year: string, today: DateParts = todayParts()): BirthDateResult {
  const raw = [day.trim(), month.trim(), year.trim()]
  if (raw.some((part) => !part) || year.trim().length < 4) return { ok: false, reason: 'incomplete' }
  if (!raw.every(onlyDigits)) return { ok: false, reason: 'invalid' }

  const parts = { day: Number(raw[0]), month: Number(raw[1]), year: Number(raw[2]) }
  if (!isValidDate(parts)) return { ok: false, reason: 'invalid' }
  if (compare(parts, today) > 0) return { ok: false, reason: 'future' }

  const age = ageOn(parts, today)
  if (age > MAX_AGE) return { ok: false, reason: 'implausible' }
  if (age < MIN_AGE) return { ok: false, reason: 'underage' }
  return { ok: true, iso: formatIsoDate(parts), age }
}

export function birthDateMessage(reason: Exclude<BirthDateResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'incomplete':
      return 'Completa día, mes y año (el año con 4 cifras).'
    case 'invalid':
      return 'Esa fecha no existe. Revisa el día y el mes.'
    case 'future':
      return 'Esa fecha todavía no llega. Revisa el año.'
    case 'implausible':
      return 'Revisa el año: parece mal escrito.'
    case 'underage':
      return `Encorely es solo para mayores de ${MIN_AGE} años.`
  }
}
