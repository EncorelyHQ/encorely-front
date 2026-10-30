import type { LegalCurrent } from '@/lib/api/types'

export type LegalDocument = {
  key: 'terms' | 'privacy' | 'deletion'
  title: string
  subtitle: string
  url: string
}

const DOCUMENTS: { key: LegalDocument['key']; field: keyof LegalCurrent; title: string; subtitle: string }[] = [
  { key: 'terms', field: 'termsUrl', title: 'Términos de uso', subtitle: 'Las reglas para usar Encorely.' },
  {
    key: 'privacy',
    field: 'privacyUrl',
    title: 'Política de tratamiento de datos',
    subtitle: 'Qué datos guardamos, para qué y tus derechos.',
  },
  {
    key: 'deletion',
    field: 'accountDeletionUrl',
    title: 'Borrar la cuenta desde la web',
    subtitle: 'Por si ya no tienes la app instalada.',
  },
]

// Una URL vacía o sin http abriría un navegador en blanco: ese documento no se muestra.
export function legalDocumentsOf(legal: LegalCurrent | null | undefined): LegalDocument[] {
  if (!legal) return []
  return DOCUMENTS.flatMap(({ key, field, title, subtitle }) => {
    const url = legal[field]
    return isHttpUrl(url) ? [{ key, title, subtitle, url: url.trim() }] : []
  })
}

export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim())
}

// effectiveDate viene como fecha sin hora (yyyy-MM-dd): se muestra tal cual en mono, sin pasar por zona horaria.
export function effectiveDateLabel(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}
