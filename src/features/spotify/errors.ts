import { userMessage } from '@/lib/api/errors'

export type SpotifyErrorKind =
  | 'cancelled'
  | 'denied'
  | 'state'
  | 'expired'
  | 'config'
  | 'network'
  | 'timeout'
  | 'devMode'
  | 'auth'
  | 'rateLimited'
  | 'server'
  | 'empty'
  | 'unknown'

// Qué pasó + qué hacer. Nunca el cuerpo de la respuesta de Spotify: puede traer detalles internos.
const MESSAGES: Record<SpotifyErrorKind, string> = {
  cancelled: 'Cerraste Spotify antes de terminar. Puedes conectarlo cuando quieras.',
  denied: 'No diste permiso en Spotify, así que no leímos nada. Puedes intentarlo cuando quieras.',
  state: 'La respuesta de Spotify no corresponde a esta solicitud. Vuelve a conectar desde aquí.',
  expired: 'La conexión con Spotify tardó demasiado. Vuelve a intentarlo.',
  config: 'La app no tiene configurada la conexión con Spotify.',
  network: 'Sin conexión con Spotify. Revisa tu internet e intenta otra vez.',
  timeout: 'Spotify tardó demasiado en responder. Intenta otra vez.',
  devMode: 'Spotify limita esta función a cuentas de prueba mientras la app está en desarrollo.',
  auth: 'Spotify cerró el permiso. Vuelve a conectar tu cuenta.',
  rateLimited: 'Spotify está recibiendo demasiadas solicitudes. Espera un minuto e intenta otra vez.',
  server: 'Spotify no responde en este momento. Intenta de nuevo en un rato.',
  empty: 'Tu Spotify todavía no tiene artistas frecuentes. Escucha un poco más y vuelve a intentarlo.',
  unknown: 'No pudimos leer tu música de Spotify. Intenta otra vez.',
}

export class SpotifyError extends Error {
  readonly kind: SpotifyErrorKind
  readonly status: number

  constructor(kind: SpotifyErrorKind, status = 0) {
    super(MESSAGES[kind])
    this.name = 'SpotifyError'
    this.kind = kind
    this.status = status
  }
}

export function isSpotifyError(error: unknown, kind?: SpotifyErrorKind): error is SpotifyError {
  return error instanceof SpotifyError && (kind === undefined || error.kind === kind)
}

export function spotifyErrorFromStatus(status: number): SpotifyError {
  if (status === 401) return new SpotifyError('auth', status)
  // En modo desarrollo Spotify responde 403 a toda cuenta que no esté en la lista de usuarios de prueba.
  if (status === 403) return new SpotifyError('devMode', status)
  if (status === 429) return new SpotifyError('rateLimited', status)
  if (status >= 500) return new SpotifyError('server', status)
  return new SpotifyError('unknown', status)
}

// Errores de /api/token (RFC 6749 §5.2): el `error` del cuerpo dice más que el status, que casi siempre es 400.
export function spotifyTokenError(status: number, oauthError: unknown): SpotifyError {
  if (oauthError === 'invalid_grant') return new SpotifyError('auth', status)
  if (oauthError === 'invalid_client' || oauthError === 'unauthorized_client') return new SpotifyError('config', status)
  if (status === 400) return new SpotifyError('unknown', status)
  return spotifyErrorFromStatus(status)
}

// Un solo punto para el texto al usuario: errores de Spotify o del API de Encorely.
export function spotifyUserMessage(error: unknown): string {
  if (error instanceof SpotifyError) return error.message
  return userMessage(error)
}
