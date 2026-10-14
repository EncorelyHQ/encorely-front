// Reglas espejo del back (RegisterRequest/LoginRequest): validar aquí solo evita un viaje, el back manda.
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_BYTES = 72
export const EMAIL_MAX_LENGTH = 254

const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function emailError(value: string): string | null {
  const email = normalizeEmail(value)
  if (!email) return 'Escribe tu correo.'
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_SHAPE.test(email)) return 'Revisa el correo: debe verse como nombre@dominio.com.'
  return null
}

// BCrypt solo mira los primeros 72 bytes: el back rechaza más para que nadie crea que su clave larga cuenta entera.
export function utf8ByteLength(value: string): number {
  let bytes = 0
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x7f) bytes += 1
    else if (code <= 0x7ff) bytes += 2
    else if (code <= 0xffff) bytes += 3
    else bytes += 4
  }
  return bytes
}

export function newPasswordError(value: string): string | null {
  if (!value) return 'Escribe una contraseña.'
  if (value.length < PASSWORD_MIN_LENGTH) return `Le faltan caracteres: usa al menos ${PASSWORD_MIN_LENGTH}.`
  if (utf8ByteLength(value) > PASSWORD_MAX_BYTES) return 'Es demasiado larga. Acórtala un poco.'
  return null
}

export function loginPasswordError(value: string): string | null {
  return value ? null : 'Escribe tu contraseña.'
}

// El nombre se valida igual en registro, onboarding y perfil.
export { validateDisplayName as displayNameError } from '@/features/shared/profileRules'
