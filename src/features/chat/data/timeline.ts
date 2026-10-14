import { formatDayLabel, sameDay } from './format'
import type { ChatMessage } from './messages'

// Mensajes seguidos del mismo autor con menos de esto entre sí se agrupan (una sola hora al final).
export const GROUP_WINDOW_MS = 5 * 60 * 1000

export type TimelineRow =
  | { kind: 'message'; key: string; message: ChatMessage; firstInGroup: boolean; lastInGroup: boolean }
  | { kind: 'day'; key: string; label: string }
  | { kind: 'matchIntro'; key: string }
  | { kind: 'keyChange'; key: string }

type BuildOptions = {
  now: number
  // Solo cuando ya no queda historial por cargar: el "hicieron match" es el inicio real de la conversación.
  showIntro: boolean
  showKeyChange: boolean
}

function continues(prev: ChatMessage | undefined, next: ChatMessage): boolean {
  return (
    !!prev &&
    prev.senderId === next.senderId &&
    sameDay(prev.at, next.at) &&
    next.at - prev.at <= GROUP_WINDOW_MS &&
    prev.status !== 'undecryptable' &&
    next.status !== 'undecryptable'
  )
}

// Filas en orden cronológico (la más vieja primero). La pantalla las invierte para la FlatList invertida.
export function buildTimeline(messages: readonly ChatMessage[], options: BuildOptions): TimelineRow[] {
  const rows: TimelineRow[] = []
  if (options.showIntro) rows.push({ kind: 'matchIntro', key: 'intro' })

  messages.forEach((message, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    if (!prev || !sameDay(prev.at, message.at)) {
      rows.push({ kind: 'day', key: `day-${message.at}-${message.id}`, label: formatDayLabel(message.at, options.now) })
    }
    rows.push({
      kind: 'message',
      key: message.id,
      message,
      firstInGroup: !continues(prev, message),
      lastInGroup: !next || !continues(message, next),
    })
  })

  // No sabemos en qué punto del historial cambió la llave (no hay historial local): el aviso va al final, donde se lee.
  if (options.showKeyChange) rows.push({ kind: 'keyChange', key: 'key-change' })
  return rows
}
