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
