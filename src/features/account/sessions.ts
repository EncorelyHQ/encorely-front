import type { AccountSession } from '@/lib/api/endpoints'

const LOCALE = 'es-CO'
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// El back emite el refresh (lastUsedAt) un instante ANTES que el access token, y `iat` va truncado a segundos:
// la sesión de este teléfono tiene lastUsedAt en [iat - margen, iat + 1 s).
const ISSUE_SKEW_BEFORE_MS = 5_000
const ISSUE_SKEW_AFTER_MS = 1_000

export type SessionRow = {
  id: string
  isCurrent: boolean
  title: string
  startedLabel: string
  lastUsedLabel: string
  accessibilityLabel: string
}

// Lee `iat` (segundos) del payload del JWT. No valida la firma: solo sirve para reconocer esta sesión en la lista.
export function issuedAtOf(accessToken: string | null | undefined): number | null {
  const payload = accessToken?.split('.')[1]
  if (!payload) return null
  try {
    const json = JSON.parse(decodeBase64Url(payload)) as { iat?: unknown }
    return typeof json.iat === 'number' && Number.isFinite(json.iat) ? json.iat : null
  } catch {
    // Base64 o JSON inválidos (atob lanza DOMException): un token ilegible solo significa "no sé cuál es esta sesión".
    return null
  }
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
}

// El contrato no marca la sesión actual (ni trae dispositivo): se infiere cruzando lastUsedAt con el `iat` del token.
// Si hay cero o varias candidatas no se adivina: ninguna queda marcada como "Este teléfono".
export function findCurrentSessionId(sessions: readonly AccountSession[], issuedAtSec: number | null): string | null {
  if (issuedAtSec === null) return null
  const issuedMs = issuedAtSec * 1000
  const matches = sessions.filter((s) => {
    const used = Date.parse(s.lastUsedAt)
    return used >= issuedMs - ISSUE_SKEW_BEFORE_MS && used < issuedMs + ISSUE_SKEW_AFTER_MS
  })
  return matches.length === 1 ? matches[0].id : null
}

export function otherSessionIds(sessions: readonly AccountSession[], currentId: string | null): string[] {
  if (!currentId) return []
  return sessions.filter((s) => s.id !== currentId).map((s) => s.id)
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
  currentId: string | null,
  options: FormatOptions,
): SessionRow[] {
  return [...sessions]
    .sort((a, b) => {
      if (a.id === currentId) return -1
      if (b.id === currentId) return 1
      return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt)
    })
    .map((s) => {
      const isCurrent = s.id === currentId
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
