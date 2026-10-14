import type { Me } from '@/lib/api/types'
import {
  acceptedConsentVersionOf,
  currentConsentVersionOf,
  decideConsent,
  shouldRedirectToConsent,
} from '../consent'
import { contactMailto, PRIVACY_CONTACT_EMAIL } from '../contact'
import { effectiveDateLabel, legalDocumentsOf } from '../legal'

const me = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'u',
    email: 'ana@correo.com',
    displayName: 'Ana',
    birthDate: null,
    age: null,
    city: null,
    bio: null,
    genres: [],
    onboardingCompleted: true,
    role: 'user',
    createdAt: '2026-10-01T00:00:00Z',
    ...extra,
  }) as Me

describe('decideConsent', () => {
  it('pide consentimiento si el servidor respondió consent_required, sin importar lo demás', () => {
    expect(decideConsent({ currentVersion: '2026-10-13', acceptedVersion: '2026-10-13', serverRequiresConsent: true })).toBe(
      'required',
    )
  })

  it('no bloquea cuando el back no expone la versión aceptada', () => {
    expect(decideConsent({ currentVersion: '2026-10-13', acceptedVersion: undefined, serverRequiresConsent: false })).toBe(
      'unknown',
    )
  })

  it('no bloquea si todavía no se sabe la versión vigente', () => {
    expect(decideConsent({ currentVersion: null, acceptedVersion: '2026-01-01', serverRequiresConsent: false })).toBe('unknown')
  })

  it('compara la versión aceptada con la vigente', () => {
    expect(decideConsent({ currentVersion: '2026-10-13', acceptedVersion: '2026-10-13', serverRequiresConsent: false })).toBe('ok')
    expect(decideConsent({ currentVersion: '2026-10-13', acceptedVersion: '2026-01-01', serverRequiresConsent: false })).toBe(
      'required',
    )
    expect(decideConsent({ currentVersion: '2026-10-13', acceptedVersion: null, serverRequiresConsent: false })).toBe('required')
  })
})

describe('shouldRedirectToConsent', () => {
  it('redirige solo si hace falta y no se está ya en /consent', () => {
    expect(shouldRedirectToConsent('required', '/')).toBe(true)
    expect(shouldRedirectToConsent('required', '/consent')).toBe(false)
    expect(shouldRedirectToConsent('ok', '/')).toBe(false)
    expect(shouldRedirectToConsent('unknown', '/')).toBe(false)
  })
})

describe('acceptedConsentVersionOf', () => {
  it('es undefined con el contrato actual (MeResponse no trae el dato)', () => {
    expect(acceptedConsentVersionOf(me())).toBeUndefined()
    expect(acceptedConsentVersionOf(undefined)).toBeUndefined()
  })

  it('lee el campo cuando el back lo agregue', () => {
    expect(acceptedConsentVersionOf(me({ acceptedConsentVersion: '2026-10-13' }))).toBe('2026-10-13')
    expect(acceptedConsentVersionOf(me({ consentVersion: '2026-01-01' }))).toBe('2026-01-01')
    expect(acceptedConsentVersionOf(me({ acceptedConsentVersion: null }))).toBeNull()
  })

  it('currentConsentVersionOf ignora versiones vacías', () => {
    expect(currentConsentVersionOf({ consentVersion: '  ' })).toBeNull()
    expect(currentConsentVersionOf({ consentVersion: '2026-10-13' })).toBe('2026-10-13')
  })
})

describe('documentos legales y contacto', () => {
  const legal = {
    consentVersion: '2026-10-13',
    effectiveDate: '2026-10-13',
    termsUrl: 'https://api.encorely.example/legal/terminos',
    privacyUrl: '',
    accountDeletionUrl: 'https://api.encorely.example/cuenta/eliminar',
  }

  it('omite documentos sin URL usable', () => {
    expect(legalDocumentsOf(legal).map((d) => d.key)).toEqual(['terms', 'deletion'])
    expect(legalDocumentsOf(undefined)).toEqual([])
  })

  it('la fecha vigente solo se muestra si es yyyy-MM-dd', () => {
    expect(effectiveDateLabel('2026-10-13')).toBe('2026-10-13')
    expect(effectiveDateLabel('13/10/2026')).toBeNull()
  })

  it('sin correo real del dueño no hay mailto', () => {
    expect(PRIVACY_CONTACT_EMAIL).toBeNull()
    expect(contactMailto(PRIVACY_CONTACT_EMAIL)).toBeNull()
    expect(contactMailto('datos@dominio.co')).toMatch(/^mailto:datos@dominio\.co\?subject=/)
  })
})
