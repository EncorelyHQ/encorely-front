import { SPOTIFY_TIMEOUT_MS } from './config'
import { SpotifyError } from './errors'

// fetch con tope de tiempo: en un concierto la señal es mala y una espera infinita deja el botón colgado.
export async function spotifyFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SPOTIFY_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    throw new SpotifyError(controller.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }
}

export async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await response.json()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    // Cuerpo vacío o no JSON (p. ej. una página de error de un proxy): quien llama decide por el status.
    return null
  }
}

export function encodeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

// Parser propio: el URLSearchParams de React Native es un subconjunto y no queremos depender de sus huecos.
export function parseQuery(url: string): Record<string, string> {
  const out: Record<string, string> = {}
  const queryStart = url.indexOf('?')
  if (queryStart === -1) return out
  const hashStart = url.indexOf('#', queryStart)
  const query = url.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart)
  for (const pair of query.split('&')) {
    if (!pair) continue
    const [rawKey, ...rest] = pair.split('=')
    const key = safeDecode(rawKey)
    if (key && !(key in out)) out[key] = safeDecode(rest.join('='))
  }
  return out
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    // Secuencia % inválida: se descarta el valor y la validación posterior lo rechaza.
    return ''
  }
}
