import type { ReceivedReaction, ReceivedReactionPage } from '@/lib/api/types'

export const nextCursorOf = (page: ReceivedReactionPage): string | undefined => page.nextCursor ?? undefined

// Si alguien cambia su reacción mientras se pagina, puede aparecer en dos páginas: se queda la más reciente.
export function flattenReceived(pages: readonly ReceivedReactionPage[] | undefined): ReceivedReaction[] {
  const seen = new Set<string>()
  const out: ReceivedReaction[] = []
  for (const page of pages ?? []) {
    for (const item of page.items) {
      const key = `${item.from.userId}|${item.targetKind}|${item.targetKey}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

const DAY = 24 * 60 * 60 * 1000
const startOfDay = (ms: number) => {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "hoy", "ayer" o "12 oct": la hora exacta de una reacción no le importa a nadie.
export function reactedAtLabel(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  const d = new Date(at)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`
}
