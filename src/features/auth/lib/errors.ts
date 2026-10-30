// Directo al módulo de errores: el índice de spotify arrastra componentes y este archivo es lógica pura.
import { isSpotifyError } from '@/features/spotify/errors'
import { ApiError, isApiError, userMessage } from '@/lib/api/errors'

export const INVALID_CREDENTIALS = 'El correo o la contraseña no coinciden.'
export const RATE_LIMITED = 'Hiciste muchos intentos seguidos. Espera unos minutos y vuelve a intentarlo.'
export const EMAIL_TAKEN = 'Ya hay una cuenta con este correo. Si es tuya, entra con tu contraseña.'
export const CONSENT_CHANGED = 'Los términos se actualizaron. Revísalos y vuelve a aceptarlos.'

export const ACCOUNT_BANNED = 'Esta cuenta está suspendida. Si crees que es un error, escríbenos.'

export type FormErrors<F extends string> = { fields: Partial<Record<F, string>>; general: string | null }

function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'http' && (error.status === 429 || error.code === 'rate_limited')
}

// Errores 400 del back por campo; `aliases` traduce claves del back a los campos del formulario.
function pickFields<F extends string>(error: ApiError, fields: readonly F[], aliases: Record<string, F> = {}) {
  const out: Partial<Record<F, string>> = {}
  for (const name of fields) {
    const message = error.field(name)
    if (message) out[name] = message
  }
  for (const [backKey, field] of Object.entries(aliases)) {
    const message = error.field(backKey)
    if (message && !out[field]) out[field] = message
  }
  return out
}

export type LoginField = 'email' | 'password'

export function loginErrors(error: unknown): FormErrors<LoginField> {
  if (isRateLimited(error)) return { fields: {}, general: RATE_LIMITED }
  if (isApiError(error, 'account_banned')) return { fields: {}, general: ACCOUNT_BANNED }
  if (error instanceof ApiError && error.kind === 'http') {
    if (error.status === 401 || error.code === 'invalid_credentials') return { fields: {}, general: INVALID_CREDENTIALS }
    if (error.status === 400) {
      const fields = pickFields(error, ['email', 'password'] as const)
      if (Object.keys(fields).length) return { fields, general: null }
    }
  }
  return { fields: {}, general: userMessage(error) }
}

export type RegisterField = 'displayName' | 'email' | 'password' | 'consent'

export function registerErrors(error: unknown): FormErrors<RegisterField> {
  if (isRateLimited(error)) return { fields: {}, general: RATE_LIMITED }
  if (isApiError(error, 'email_taken') || (error instanceof ApiError && error.kind === 'http' && error.status === 409)) {
    return { fields: { email: EMAIL_TAKEN }, general: null }
  }
  if (isApiError(error, 'account_banned')) return { fields: {}, general: ACCOUNT_BANNED }
  if (isApiError(error, 'consent_required')) return { fields: { consent: CONSENT_CHANGED }, general: null }
  if (error instanceof ApiError && error.kind === 'http' && error.status === 400) {
    const fields = pickFields(error, ['displayName', 'email', 'password'] as const, {
      consentVersion: 'consent',
      acceptTerms: 'consent',
    })
    if (Object.keys(fields).length) return { fields, general: null }
  }
  return { fields: {}, general: userMessage(error) }
}

export const SPOTIFY_EMAIL_IN_USE =
  'Ya hay una cuenta con el correo de tu Spotify. Entra con tu contraseña y, si quieres, vincula Spotify desde Tú.'
export const SPOTIFY_NOT_ALLOWED =
  'Mientras la app está en desarrollo, Spotify solo deja entrar a las cuentas de prueba registradas.'

export const SPOTIFY_ALREADY_LINKED =
  'Ese Spotify ya está vinculado a otra cuenta de Encorely, o esta cuenta ya tiene otro. Desvincúlalo primero.'
export const SPOTIFY_LAST_LOGIN_METHOD = 'Spotify es tu única forma de entrar a esta cuenta: no se puede desvincular.'
export const SPOTIFY_ACCOUNT_MISMATCH =
  'Ese Spotify no es el vinculado a esta cuenta. Confirma con el Spotify con el que entras a Encorely.'
export const INVALID_PASSWORD = 'La contraseña no coincide.'
export const ACCOUNT_LOCKED = 'Hiciste muchos intentos fallidos. Espera unos minutos y vuelve a intentarlo.'

// Lo común a todo lo que manda un grant de Spotify al back (entrar, vincular, borrar la cuenta).
// null = la persona cerró Spotify o no dio permiso: es su decisión, no hay nada que mostrar.
function spotifyGrantError(error: unknown): string | null | undefined {
  if (isSpotifyError(error, 'cancelled') || isSpotifyError(error, 'denied')) return null
  if (isSpotifyError(error)) return error.message
  if (isApiError(error, 'spotify_user_not_allowed')) return SPOTIFY_NOT_ALLOWED
  if (isApiError(error, 'spotify_invalid_code')) return 'La conexión con Spotify venció. Intenta otra vez.'
  if (isApiError(error, 'spotify_unavailable')) return 'Spotify no responde en este momento. Intenta de nuevo en un rato.'
  return undefined
}

export function spotifySignInError(error: unknown): string | null {
  const grant = spotifyGrantError(error)
  if (grant !== undefined) return grant
  if (isRateLimited(error)) return RATE_LIMITED
  if (isApiError(error, 'account_banned')) return ACCOUNT_BANNED
  if (isApiError(error, 'spotify_email_in_use')) return SPOTIFY_EMAIL_IN_USE
  if (isApiError(error, 'spotify_email_missing')) return 'Tu cuenta de Spotify no tiene un correo. Crea tu cuenta con correo y contraseña.'
  if (isApiError(error, 'consent_required')) return CONSENT_CHANGED
  return userMessage(error)
}

export function spotifyLinkError(error: unknown): string | null {
  const grant = spotifyGrantError(error)
  if (grant !== undefined) return grant
  if (isApiError(error, 'spotify_already_linked')) return SPOTIFY_ALREADY_LINKED
  if (isApiError(error, 'spotify_last_login_method')) return SPOTIFY_LAST_LOGIN_METHOD
  if (isRateLimited(error)) return RATE_LIMITED
  return userMessage(error)
}

// 403 invalid_password no cierra la sesión (el contrato lo separa del 401): solo se vuelve a pedir la contraseña.
export function deleteAccountError(error: unknown): { password: string | null; general: string | null } {
  if (isApiError(error, 'invalid_password')) return { password: INVALID_PASSWORD, general: null }
  if (isApiError(error, 'account_locked')) return { password: null, general: ACCOUNT_LOCKED }
  if (isApiError(error, 'spotify_account_mismatch')) return { password: null, general: SPOTIFY_ACCOUNT_MISMATCH }
  if (isRateLimited(error)) return { password: null, general: RATE_LIMITED }
  if (error instanceof ApiError && error.kind === 'http' && error.status === 400) {
    const password = error.field('password')
    if (password) return { password, general: null }
  }
  const grant = spotifyGrantError(error)
  if (grant !== undefined) return { password: null, general: grant }
  return { password: null, general: userMessage(error) }
}
