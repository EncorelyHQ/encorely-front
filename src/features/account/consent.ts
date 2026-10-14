import type { LegalCurrent } from '@/lib/api/types'

export const CONSENT_ROUTE = '/consent'
export const CONSENT_REQUIRED_CODE = 'consent_required'

export type ConsentDecision = 'required' | 'ok'

type DecisionInput = {
  // GET /me: false = el usuario no aceptó la versión vigente. undefined mientras /me carga.
  consentUpToDate: boolean | undefined
  // Una respuesta del API con code=consent_required en una petición autenticada.
  serverRequiresConsent: boolean
}

export function decideConsent({ consentUpToDate, serverRequiresConsent }: DecisionInput): ConsentDecision {
  return serverRequiresConsent || consentUpToDate === false ? 'required' : 'ok'
}

export function shouldRedirectToConsent(decision: ConsentDecision, pathname: string): boolean {
  return decision === 'required' && pathname !== CONSENT_ROUTE
}

export function currentConsentVersionOf(legal: Pick<LegalCurrent, 'consentVersion'> | null | undefined): string | null {
  const version = legal?.consentVersion
  return typeof version === 'string' && version.trim() ? version : null
}
