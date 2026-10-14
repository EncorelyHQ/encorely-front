import { normalizePassphrase } from '../crypto/backupCipher'

export const MIN_WORDS = 4
export const MIN_CHARS = 16

export type PassphraseStrength = {
  /** Cumple el mínimo para crear el respaldo. */
  ok: boolean
  level: 'empty' | 'weak' | 'fair' | 'strong'
  /** 0..1 para la barra. */
  score: number
  hint: string
}

// Frases tipo "tres perros comen arepa": la longitud manda. Esto no estima entropía real; solo frena lo obvio
// (pocas palabras, una letra repetida) y pide el mínimo acordado: 4 palabras o 16 caracteres.
export function passphraseStrength(raw: string): PassphraseStrength {
  const text = normalizePassphrase(raw)
  if (text.length === 0) return { ok: false, level: 'empty', score: 0, hint: `Usa ${MIN_WORDS} palabras o más.` }

  const words = text.split(' ').filter((w) => w.length >= 2)
  const distinctWords = new Set(words.map((w) => w.toLowerCase())).size
  const distinctChars = new Set(text.toLowerCase().replace(/\s/g, '')).size
  const repetitive = distinctChars < 6 || (words.length >= 2 && distinctWords < Math.min(words.length, MIN_WORDS))
  const longEnough = distinctWords >= MIN_WORDS || text.length >= MIN_CHARS

  if (!longEnough || repetitive) {
    return {
      ok: false,
      level: 'weak',
      score: Math.min(0.3, text.length / (MIN_CHARS * 3)),
      hint: repetitive ? 'Tiene muchas repeticiones. Usa palabras distintas.' : `Usa ${MIN_WORDS} palabras o ${MIN_CHARS} caracteres.`,
    }
  }
  const strong = distinctWords >= 6 || text.length >= 28
  return strong
    ? { ok: true, level: 'strong', score: 1, hint: 'Buena frase. Guárdala en un lugar seguro.' }
    : { ok: true, level: 'fair', score: 0.65, hint: 'Sirve. Con una o dos palabras más queda mejor.' }
}
