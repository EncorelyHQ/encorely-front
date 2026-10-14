import type { AccountSession } from '@/lib/api/endpoints'

const LOCALE = 'es-CO'
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type SessionRow = {
  id: string
  isCurrent: boolean
  title: string
  startedLabel: string
  lastUsedLabel: string
  accessibilityLabel: string
}

export function otherSessionIds(sessions: readonly AccountSession[]): string[] {
  return sessions.filter((s) => !s.current).map((s) => s.id)
}

type FormatOptions = { now: number; timeZone?: string }

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim()

export function formatSessionDate(iso: string, { timeZone }: Pick<FormatOptions, 'timeZone'> = {}): string {
  const date = new Date(iso)
  const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone }).format(date)
  const month = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone }).format(date)
  const year = new Intl.DateTimeFormat(LOCALE, { year: 'numeric', timeZone }).format(date)
  return `${day} ${normalizeSpaces(month).replace(/\.$/, '')} ${year}`
}

// "ahora", "hace 5 min", "hace 3 h"; pasado un día, la fecha: "hace 9 días" no ayuda a reconocer un teléfono.
export function formatLastUsed(iso: string, { now, timeZone }: FormatOptions): string {
  const elapsed = Math.max(0, now - Date.parse(iso))
  if (elapsed < MINUTE) return 'ahora'
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`
  return formatSessionDate(iso, { timeZone })
}

export function toSessionRows(
  sessions: readonly AccountSession[],
  options: FormatOptions,
): SessionRow[] {
  return [...sessions]
    .sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1
      return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt)
    })
    .map((s) => {
      const isCurrent = s.current
      const title = isCurrent ? 'Este teléfono' : 'Otro dispositivo'
      const startedLabel = formatSessionDate(s.createdAt, options)
      const lastUsedLabel = formatLastUsed(s.lastUsedAt, options)
      return {
        id: s.id,
        isCurrent,
        title,
        startedLabel,
        lastUsedLabel,
        accessibilityLabel: `${title}. Inició el ${startedLabel}. Último uso: ${lastUsedLabel}.`,
      }
    })
}
