// Canal de consultas y reclamos (Ley 1581 de 2012, art. 14 y 15; Decreto 1377 de 2013).
// Fallback: el correo real llega en GET /legal/current (privacyContactEmail). Solo se usa si el back no lo trae.
export const PRIVACY_CONTACT_EMAIL: string | null = null

// Plazos legales que la app le comunica al titular (Ley 1581, art. 14 y 15).
export const CLAIM_TERMS = {
  queryBusinessDays: 10,
  claimBusinessDays: 15,
} as const

// Autoridad ante la que el titular puede quejarse si no le responden (Ley 1581, art. 16 y 22).
export const SIC_URL = 'https://www.sic.gov.co'

export function contactMailto(email: string | null): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  const subject = encodeURIComponent('Consulta o reclamo sobre mis datos personales')
  return `mailto:${email}?subject=${subject}`
}
