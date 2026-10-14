import type { LegalCurrent, Me } from '@/lib/api/types'

export const CONSENT_ROUTE = '/consent'
export const CONSENT_REQUIRED_CODE = 'consent_required'

// 'unknown': el back todavía no expone qué versión aceptó el usuario; no se bloquea a nadie por suposición.
export type ConsentDecision = 'required' | 'ok' | 'unknown'

type DecisionInput = {
  currentVersion: string | null | undefined
  // undefined = el contrato no trae el dato; null = el back dice que no ha aceptado ninguna.
  acceptedVersion: string | null | undefined
  // Una respuesta del API con code=consent_required en una petición autenticada.
  serverRequiresConsent: boolean
}

export function decideConsent({ currentVersion, acceptedVersion, serverRequiresConsent }: DecisionInput): ConsentDecision {
  if (serverRequiresConsent) return 'required'
  if (!currentVersion || acceptedVersion === undefined) return 'unknown'
  return acceptedVersion === currentVersion ? 'ok' : 'required'
}

export function shouldRedirectToConsent(decision: ConsentDecision, pathname: string): boolean {
  return decision === 'required' && pathname !== CONSENT_ROUTE
}

// Hoy MeResponse no trae la versión aceptada. Se lee de forma tolerante para que, cuando el back agregue
// `acceptedConsentVersion` (o `consentVersion`) a GET /me, el gate funcione sin tocar este feature.
export function acceptedConsentVersionOf(me: Me | null | undefined): string | null | undefined {
  if (!me) return undefined
  const record = me as Me & Record<string, unknown>
  for (const key of ['acceptedConsentVersion', 'consentVersion'] as const) {
    if (!(key in record)) continue
    const value = record[key]
    if (value === null) return null
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function currentConsentVersionOf(legal: Pick<LegalCurrent, 'consentVersion'> | null | undefined): string | null {
  const version = legal?.consentVersion
  return typeof version === 'string' && version.trim() ? version : null
}
