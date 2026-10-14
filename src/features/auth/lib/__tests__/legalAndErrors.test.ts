import { ApiError } from '@/lib/api/errors'
import { SpotifyError } from '@/features/spotify/errors'
import {
  ACCOUNT_BANNED,
  ACCOUNT_LOCKED,
  CONSENT_CHANGED,
  deleteAccountError,
  EMAIL_TAKEN,
  INVALID_CREDENTIALS,
  INVALID_PASSWORD,
  loginErrors,
  RATE_LIMITED,
  registerErrors,
  SPOTIFY_ACCOUNT_MISMATCH,
  SPOTIFY_ALREADY_LINKED,
  SPOTIFY_EMAIL_IN_USE,
  SPOTIFY_LAST_LOGIN_METHOD,
  SPOTIFY_NOT_ALLOWED,
  spotifyLinkError,
  spotifySignInError,
} from '../errors'
import { consentVersionOf, legalLinksOf } from '../legal'
import { toSpotifyLoginRequest } from '../spotify'

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
    expect(loginErrors(http(403, 'account_banned')).general).toBe(ACCOUNT_BANNED)
  })

  it('consentimiento desactualizado va a la casilla', () => {
    expect(registerErrors(http(400, 'consent_required')).fields.consent).toBe(CONSENT_CHANGED)
  })

  it('cuenta suspendida da un mensaje general sin detalles', () => {
    expect(registerErrors(http(403, 'account_banned'))).toEqual({ fields: {}, general: ACCOUNT_BANNED })
  })

  it('traduce consentVersion del back a la casilla', () => {
    const result = registerErrors(http(400, 'validation_failed', { ConsentVersion: ['Es obligatorio.'], Password: ['Corta'] }))
    expect(result.fields).toEqual({ consent: 'Es obligatorio.', password: 'Corta' })
  })
})

describe('spotifySignInError', () => {
  const api = (status: number, code: string) => new ApiError('http', 'x', { status, code })

  it('calla cuando la persona cerró Spotify o no dio permiso', () => {
    expect(spotifySignInError(new SpotifyError('cancelled'))).toBeNull()
    expect(spotifySignInError(new SpotifyError('denied'))).toBeNull()
  })

  it('explica cada rechazo del back sin filtrar detalles', () => {
    expect(spotifySignInError(api(409, 'spotify_email_in_use'))).toBe(SPOTIFY_EMAIL_IN_USE)
    expect(spotifySignInError(api(403, 'spotify_user_not_allowed'))).toBe(SPOTIFY_NOT_ALLOWED)
    expect(spotifySignInError(api(403, 'account_banned'))).toBe(ACCOUNT_BANNED)
    expect(spotifySignInError(api(429, 'rate_limited'))).toBe(RATE_LIMITED)
    expect(spotifySignInError(api(400, 'consent_required'))).toBe(CONSENT_CHANGED)
  })
})

describe('spotifyLinkError', () => {
  const api = (status: number, code: string) => new ApiError('http', 'x', { status, code })

  it('calla si la persona cerró Spotify y explica los 409 del vínculo', () => {
    expect(spotifyLinkError(new SpotifyError('cancelled'))).toBeNull()
    expect(spotifyLinkError(api(409, 'spotify_already_linked'))).toBe(SPOTIFY_ALREADY_LINKED)
    expect(spotifyLinkError(api(409, 'spotify_last_login_method'))).toBe(SPOTIFY_LAST_LOGIN_METHOD)
    expect(spotifyLinkError(api(403, 'spotify_user_not_allowed'))).toBe(SPOTIFY_NOT_ALLOWED)
  })
})

describe('deleteAccountError', () => {
  const api = (status: number, code: string) => new ApiError('http', 'x', { status, code })

  it('la contraseña incorrecta va al campo, sin mensaje general', () => {
    expect(deleteAccountError(api(403, 'invalid_password'))).toEqual({ password: INVALID_PASSWORD, general: null })
  })

  it('el bloqueo por intentos gana al 429 genérico', () => {
    expect(deleteAccountError(api(429, 'account_locked')).general).toBe(ACCOUNT_LOCKED)
    expect(deleteAccountError(api(429, 'rate_limited')).general).toBe(RATE_LIMITED)
  })

  it('reconfirmar con otro Spotify lo explica; cerrar Spotify no muestra nada', () => {
    expect(deleteAccountError(api(403, 'spotify_account_mismatch')).general).toBe(SPOTIFY_ACCOUNT_MISMATCH)
    expect(deleteAccountError(new SpotifyError('cancelled'))).toEqual({ password: null, general: null })
  })
})

describe('toSpotifyLoginRequest', () => {
  it('solo marca acceptTerms cuando hubo versión de consentimiento', () => {
    const grant = { code: 'c', codeVerifier: 'v', redirectUri: 'encorely://spotify-callback' }
    expect(toSpotifyLoginRequest({ ...grant, consentVersion: '2026-09' })).toEqual({
      ...grant,
      acceptTerms: true,
      consentVersion: '2026-09',
    })
    expect(toSpotifyLoginRequest({ ...grant, consentVersion: null }).acceptTerms).toBe(false)
  })
})
