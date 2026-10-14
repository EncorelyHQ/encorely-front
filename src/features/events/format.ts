import type { EventSummary } from '@/lib/api/types'

// Los conciertos son en Colombia: la hora que importa es la del venue, no la del teléfono.
export const EVENT_TIME_ZONE = 'America/Bogota'
const LOCALE = 'es-CO'

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: EVENT_TIME_ZONE, ...options })

// Formateadores separados en vez de formatToParts: es lo más portable entre ICU de Node y Hermes.
const dayFmt = fmt({ day: 'numeric' })
const monthShortFmt = fmt({ month: 'short' })
const monthLongFmt = fmt({ month: 'long' })
const weekdayFmt = fmt({ weekday: 'long' })
const weekdayShortFmt = fmt({ weekday: 'short' })
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit', hour12: true })

export type EventDateParts = {
  day: string
  // "NOV": abreviatura de boleta, sin punto.
  monthShort: string
  // "SÁB"
  weekdayShort: string
  // "8 p. m." o "8:30 p. m." (los minutos en cero no aportan).
  time: string
  // "sábado 22 de noviembre"
  long: string
}

// ICU mete espacios finos/no separables distintos según la plataforma; los dejamos en espacio normal.
const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim()
const stripDot = (value: string) => value.replace(/\.$/, '')

export function formatEventDate(iso: string): EventDateParts {
  const date = new Date(iso)
  const day = dayFmt.format(date)
  const time = normalizeSpaces(timeFmt.format(date)).replace(':00 ', ' ')
  return {
    day,
    monthShort: stripDot(normalizeSpaces(monthShortFmt.format(date))).toUpperCase(),
    weekdayShort: stripDot(normalizeSpaces(weekdayShortFmt.format(date))).toUpperCase(),
    time,
    long: `${normalizeSpaces(weekdayFmt.format(date))} ${day} de ${normalizeSpaces(monthLongFmt.format(date))}`,
  }
}

// Tolerante a texto suelto por si un cliente viejo cacheó el lineup antes del contrato con lista.
export function lineupText(lineup: readonly string[] | string | null | undefined): string {
  if (!lineup) return ''
  if (typeof lineup === 'string') return lineup
  return lineup.filter(Boolean).join(' · ')
}

export function attendeesLabel(count: number): string | null {
  if (count <= 0) return null
  return count === 1 ? '1 va' : `${count} van`
}

export function eventAccessibilityLabel(event: EventSummary): string {
  const date = formatEventDate(event.startsAt)
  const parts = [`Concierto ${event.name}`, date.long, date.time, event.venue, event.city]
  let label = `${parts.join(', ')}.`
  if (event.iAmGoing) label += ' Vas a ir.'
  if (event.attendeeCount === 1) label += ' 1 persona va.'
  else if (event.attendeeCount > 1) label += ` ${event.attendeeCount} personas van.`
  return label
}
