import { themes } from '@/ui'

// La portada es una foto: el texto encima va siempre en la paleta oscura, sin importar el tema del sistema.
export const onCover = themes.venue

// '#RRGGBB' → 'rgba(r,g,b,a)'. Solo para derivar velos y pistas de los tokens, nunca para colores nuevos.
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
