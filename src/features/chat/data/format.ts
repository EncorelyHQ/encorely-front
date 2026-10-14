// Las horas del chat son las del teléfono (no las del venue): cada quien lee su propia hora local.
const LOCALE = 'es-CO'

const clockFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true })
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' })
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
const longDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })

const DAY_MS = 24 * 60 * 60 * 1000

// ICU mete espacios finos distintos según plataforma y abrevia con punto ("oct."): se normaliza.
const tidy = (value: string) => value.replace(/\s+/g, ' ').replace(/\.(?=\s|$)/g, '').trim()

export function startOfDay(at: number): number {
  const d = new Date(at)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function formatClock(at: number): string {
  return tidy(clockFmt.format(new Date(at))).replace(/(\d)\s*([ap])\s*m$/i, '$1 $2. m.')
}

function daysBetween(at: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS)
}

export function formatDayLabel(at: number, now: number): string {
  const diff = daysBetween(at, now)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff > 1 && diff < 7) {
    const weekday = tidy(weekdayFmt.format(new Date(at)))
    return weekday.charAt(0).toUpperCase() + weekday.slice(1)
  }
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear()
  return tidy((sameYear ? shortDateFmt : longDateFmt).format(new Date(at)))
}

// Hora corta para la lista de chats: hoy → hora; ayer; esta semana → día; si no, fecha.
export function formatListTime(at: number, now: number): string {
  const diff = daysBetween(at, now)
  if (diff <= 0) return formatClock(at)
  return formatDayLabel(at, now)
}

export function formatDate(at: number): string {
  return tidy(longDateFmt.format(new Date(at)))
}

// Tamaños para avisos (respaldo): una cifra decimal basta para decidir.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
