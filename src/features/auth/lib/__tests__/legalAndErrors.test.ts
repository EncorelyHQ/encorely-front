import { ApiError } from '@/lib/api/errors'
import { CONSENT_CHANGED, EMAIL_TAKEN, INVALID_CREDENTIALS, loginErrors, RATE_LIMITED, registerErrors } from '../errors'
import { consentVersionOf, legalLinksOf } from '../legal'

const legal = (overrides: Partial<{ consentVersion: string; termsUrl: string; privacyUrl: string }> = {}) => ({
  consentVersion: '2026-09',
  termsUrl: 'https://encorely.co/terminos',
  privacyUrl: 'https://encorely.co/privacidad',
  ...overrides,
})

describe('legal', () => {
  it('lee la versión de consentimiento', () => {
    expect(consentVersionOf(legal())).toBe('2026-09')
    expect(consentVersionOf(legal({ consentVersion: '  ' }))).toBeNull()
    expect(consentVersionOf(undefined)).toBeNull()
  })

  it('solo devuelve enlaces http(s) reales', () => {
    expect(legalLinksOf(legal({ privacyUrl: '' }))).toEqual([
      { key: 'terms', label: 'Leer los términos', url: 'https://encorely.co/terminos' },
    ])
    expect(legalLinksOf(legal({ termsUrl: '', privacyUrl: 'javascript:alert(1)' }))).toEqual([])
    expect(legalLinksOf(legal())).toHaveLength(2)
  })
})

const http = (status: number, code?: string, errors?: Record<string, string[]>) =>
  ApiError.fromProblem(status, { status, code, errors, title: 'x' })

describe('loginErrors', () => {
  it('401 da un mensaje que no revela qué campo falló', () => {
    expect(loginErrors(http(401, 'invalid_credentials'))).toEqual({ fields: {}, general: INVALID_CREDENTIALS })
  })

  it('429 avisa del límite', () => {
    expect(loginErrors(http(429, 'rate_limited')).general).toBe(RATE_LIMITED)
  })

  it('400 con claves PascalCase va al campo', () => {
    expect(loginErrors(http(400, 'validation_failed', { Email: ['No es un correo válido.'] }))).toEqual({
      fields: { email: 'No es un correo válido.' },
      general: null,
    })
  })

  it('sin red usa el mensaje común', () => {
    const result = loginErrors(new ApiError('network', 'offline'))
    expect(result.general).toMatch(/internet/)
  })
})

describe('registerErrors', () => {
  it('correo repetido se marca en el campo', () => {
    expect(registerErrors(http(409, 'email_taken')).fields.email).toBe(EMAIL_TAKEN)
  })

  it('consentimiento desactualizado va a la casilla', () => {
    expect(registerErrors(http(400, 'consent_required')).fields.consent).toBe(CONSENT_CHANGED)
  })

  it('traduce consentVersion del back a la casilla', () => {
    const result = registerErrors(http(400, 'validation_failed', { ConsentVersion: ['Es obligatorio.'], Password: ['Corta'] }))
    expect(result.fields).toEqual({ consent: 'Es obligatorio.', password: 'Corta' })
  })
})
