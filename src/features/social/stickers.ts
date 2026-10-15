import type { ReactionType } from '@/lib/api/types'
import type { StickerTone } from '@/ui'

export type ReactionOption = { type: ReactionType; label: string; tone: StickerTone; hint: string }

export const REACTIONS: readonly ReactionOption[] = [
  { type: 'meToo', label: 'Yo también', tone: 'stamp', hint: 'A ti también te gusta' },
  { type: 'letsGo', label: 'Vamos a verlo', tone: 'band', hint: 'Te gustaría ir a un concierto juntos' },
  { type: 'sendOne', label: 'Pásame una', tone: 'paper', hint: 'Quieres que te recomiende una canción' },
]

export const reactionLabel = (type: ReactionType) => REACTIONS.find((r) => r.type === type)?.label ?? type
export const reactionTone = (type: ReactionType): StickerTone => REACTIONS.find((r) => r.type === type)?.tone ?? 'band'

const TONES: readonly StickerTone[] = ['paper', 'stamp', 'band', 'ink']

// Ángulo y color fijos por clave: el mismo género se ve igual en cada perfil y entre renders.
function hash(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return Math.abs(h)
}

export const stickerAngleFor = (key: string, max = 5) => (hash(key) % (2 * max + 1)) - max
export const stickerToneFor = (key: string) => TONES[hash(key) % TONES.length]
