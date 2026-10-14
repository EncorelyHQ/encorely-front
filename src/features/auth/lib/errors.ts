import { ApiError, isApiError, userMessage } from '@/lib/api/errors'

export const INVALID_CREDENTIALS = 'El correo o la contraseña no coinciden.'
export const RATE_LIMITED = 'Hiciste muchos intentos seguidos. Espera unos minutos y vuelve a intentarlo.'
export const EMAIL_TAKEN = 'Ya hay una cuenta con este correo. Si es tuya, entra con tu contraseña.'
export const CONSENT_CHANGED = 'Los términos se actualizaron. Revísalos y vuelve a aceptarlos.'

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
