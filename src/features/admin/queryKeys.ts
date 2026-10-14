import type { ReportStatus } from './types'

// Claves propias del panel bajo 'admin': no se mezclan con la caché pública de eventos o canciones.
export const adminKeys = {
  all: ['admin'] as const,
  events: ['admin', 'events'] as const,
  songs: ['admin', 'songs'] as const,
  itunes: (term: string) => ['admin', 'itunes', term] as const,
  reportsAll: ['admin', 'reports'] as const,
  reports: (status: ReportStatus) => ['admin', 'reports', status] as const,
}
