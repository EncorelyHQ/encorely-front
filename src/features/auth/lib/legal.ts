import type { LegalCurrent } from '@/lib/api/types'

type LegalPayload = Pick<LegalCurrent, 'consentVersion' | 'termsUrl' | 'privacyUrl'>

export function consentVersionOf(legal: LegalPayload | null | undefined): string | null {
  const version = legal?.consentVersion
  return typeof version === 'string' && version.trim() ? version : null
}

export type LegalLink = { key: 'terms' | 'privacy'; label: string; url: string }

// El contrato dice que las URL siempre vienen, pero un string vacío o sin http abriría un navegador en blanco:
// sin URL usable no se muestra el enlace.
export function legalLinksOf(legal: LegalPayload | null | undefined): LegalLink[] {
  const links: LegalLink[] = []
  if (isHttpUrl(legal?.termsUrl)) links.push({ key: 'terms', label: 'Leer los términos', url: legal.termsUrl.trim() })
  if (isHttpUrl(legal?.privacyUrl)) links.push({ key: 'privacy', label: 'Leer la política de datos', url: legal.privacyUrl.trim() })
  return links
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim())
}
