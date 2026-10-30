// La evidencia llega como `p`, el JSON interno firmado del mensaje (envelope del chat).
// El moderador debe leer el texto (`b`), nunca el JSON: los ids internos no le sirven y confunden.
export type ParsedEvidence =
  | { kind: 'message'; body: string; sentAt: number | null; senderId: string | null }
  | { kind: 'unreadable' }

export function parseEvidence(plaintext: string): ParsedEvidence {
  const raw = plaintext.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Un cliente que mandó texto plano: se muestra tal cual. Si parece JSON roto, no se expone.
    if (!raw || raw.startsWith('{') || raw.startsWith('[')) return { kind: 'unreadable' }
    return { kind: 'message', body: raw, sentAt: null, senderId: null }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { kind: 'unreadable' }
  const inner = parsed as Record<string, unknown>
  if (typeof inner.b !== 'string') return { kind: 'unreadable' }
  return {
    kind: 'message',
    body: inner.b,
    sentAt: typeof inner.t === 'number' && Number.isFinite(inner.t) ? inner.t : null,
    senderId: typeof inner.s === 'string' ? inner.s : null,
  }
}
