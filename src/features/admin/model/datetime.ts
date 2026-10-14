// Colombia no tiene horario de verano desde 1993: la hora de Bogotá es siempre UTC−5.
// Un offset fijo es exacto aquí y evita depender del ICU del dispositivo para convertir.
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000

const MIN_YEAR = 2000
const MAX_YEAR = 2100

export type DateParts = { day: number; month: number; year: number }
export type TimeParts = { hour: number; minute: number }

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: 'empty' | 'format' | 'invalid' }

const pad2 = (n: number) => String(n).padStart(2, '0')

function daysInMonth(year: number, month: number): number {
  // Día 0 del mes siguiente = último día del mes pedido (cubre bisiestos).
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function parseDateInput(text: string): ParseResult<DateParts> {
  const value = text.trim()
  if (!value) return { ok: false, reason: 'empty' }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return { ok: false, reason: 'format' }
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return { ok: false, reason: 'invalid' }
  if (day < 1 || day > daysInMonth(year, month)) return { ok: false, reason: 'invalid' }
  return { ok: true, value: { day, month, year } }
}

export function parseTimeInput(text: string): ParseResult<TimeParts> {
  const value = text.trim()
  if (!value) return { ok: false, reason: 'empty' }
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return { ok: false, reason: 'format' }
  const [hour, minute] = [Number(match[1]), Number(match[2])]
  if (hour > 23 || minute > 59) return { ok: false, reason: 'invalid' }
  return { ok: true, value: { hour, minute } }
}

// "22/11/2026" + "20:00" (Bogotá) → "2026-11-23T01:00:00.000Z". Date.UTC desborda la hora al día siguiente solo.
export function bogotaToIso(date: string, time: string): string | null {
  const d = parseDateInput(date)
  const t = parseTimeInput(time)
  if (!d.ok || !t.ok) return null
  const utcMs = Date.UTC(d.value.year, d.value.month - 1, d.value.day, t.value.hour, t.value.minute) - BOGOTA_OFFSET_MS
  return new Date(utcMs).toISOString()
}

// Inverso, para precargar el formulario de edición con la hora del venue y no la del teléfono.
export function isoToBogota(iso: string): { date: string; time: string } | null {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  const local = new Date(ms + BOGOTA_OFFSET_MS)
  return {
    date: `${pad2(local.getUTCDate())}/${pad2(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`,
    time: `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`,
  }
}

const digitsOnly = (raw: string) => raw.replace(/\D/g, '')

// Máscara mientras se escribe: solo dígitos y las barras van solas ("22112026" → "22/11/2026").
export function maskDateInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

export function maskTimeInput(raw: string): string {
  const d = digitsOnly(raw).slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}:${d.slice(2)}`
}

// "22/11/2026 20:00" en hora de Bogotá, para listas densas del panel.
export function bogotaLabel(iso: string): string {
  const local = isoToBogota(iso)
  return local ? `${local.date} ${local.time}` : ''
}
