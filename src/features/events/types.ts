import type { EventSummary } from '@/lib/api/types'

// El DTO del back ya trae la descripción: la lista y el detalle comparten forma.
export type EventDetail = EventSummary
