import {
  currentConsentVersionOf,
  decideConsent,
  shouldRedirectToConsent,
} from '../consent'
import { contactMailto, PRIVACY_CONTACT_EMAIL } from '../contact'
import { effectiveDateLabel, legalDocumentsOf } from '../legal'

describe('decideConsent', () => {
  it('pide consentimiento si el servidor respondió consent_required, sin importar /me', () => {
    expect(decideConsent({ consentUpToDate: true, serverRequiresConsent: true })).toBe('required')
  })

  it('pide consentimiento cuando GET /me dice consentUpToDate=false', () => {
    expect(decideConsent({ consentUpToDate: false, serverRequiresConsent: false })).toBe('required')
  })

  it('no bloquea con consentUpToDate=true ni mientras /me carga', () => {
    expect(decideConsent({ consentUpToDate: true, serverRequiresConsent: false })).toBe('ok')
    expect(decideConsent({ consentUpToDate: undefined, serverRequiresConsent: false })).toBe('ok')
  })
})

describe('shouldRedirectToConsent', () => {
  it('redirige solo si hace falta y no se está ya en /consent', () => {
    expect(shouldRedirectToConsent('required', '/')).toBe(true)
    expect(shouldRedirectToConsent('required', '/consent')).toBe(false)
    expect(shouldRedirectToConsent('ok', '/')).toBe(false)
  })
})

describe('currentConsentVersionOf', () => {
  it('ignora versiones vacías', () => {
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
    privacyContactEmail: null,
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
