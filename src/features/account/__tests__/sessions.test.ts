import type { AccountSession } from '@/lib/api/endpoints'
import {
  formatLastUsed,
  formatSessionDate,
  otherSessionIds,
  toSessionRows,
} from '../sessions'

const session = (id: string, createdAt: string, lastUsedAt: string, current = false): AccountSession => ({
  id,
  createdAt,
  lastUsedAt,
  expiresAt: '2026-12-01T00:00:00Z',
  current,
})

const TZ = 'America/Bogota'

const mine = session('mine', '2026-10-01T10:00:00Z', '2026-10-14T14:59:59Z', true)
const other = session('other', '2026-09-20T10:00:00Z', '2026-10-14T13:00:00Z')

describe('sesiones', () => {
  it('otherSessionIds excluye la sesión marcada current por el back', () => {
    expect(otherSessionIds([mine, other])).toEqual(['other'])
    expect(otherSessionIds([other])).toEqual(['other'])
  })
})

describe('formato de fechas', () => {
  const now = Date.parse('2026-10-14T15:00:00Z')

  it('fecha corta en español, sin punto en el mes', () => {
    expect(formatSessionDate('2026-10-01T15:00:00Z', { timeZone: TZ })).toBe('1 oct 2026')
  })

  it('último uso relativo en el día y absoluto después', () => {
    expect(formatLastUsed('2026-10-14T14:59:30Z', { now, timeZone: TZ })).toBe('ahora')
    expect(formatLastUsed('2026-10-14T14:55:00Z', { now, timeZone: TZ })).toBe('hace 5 min')
    expect(formatLastUsed('2026-10-14T12:00:00Z', { now, timeZone: TZ })).toBe('hace 3 h')
    expect(formatLastUsed('2026-10-10T12:00:00Z', { now, timeZone: TZ })).toBe('10 oct 2026')
  })

  it('un reloj adelantado del servidor no produce tiempos negativos', () => {
    expect(formatLastUsed('2026-10-14T15:00:20Z', { now, timeZone: TZ })).toBe('ahora')
  })
})

describe('toSessionRows', () => {
  const now = Date.parse('2026-10-14T15:00:00Z')
  const a = session('a', '2026-09-01T15:00:00Z', '2026-10-14T10:00:00Z')
  const b = session('b', '2026-10-01T15:00:00Z', '2026-10-14T14:00:00Z')
  const current = session('c', '2026-08-01T15:00:00Z', '2026-10-14T09:00:00Z', true)

  it('pone este teléfono primero y el resto por último uso', () => {
    const rows = toSessionRows([a, b, current], { now, timeZone: TZ })
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(rows[0]).toMatchObject({ isCurrent: true, title: 'Este teléfono' })
    expect(rows[1]).toMatchObject({ isCurrent: false, title: 'Otro dispositivo', lastUsedLabel: 'hace 1 h' })
  })

  it('si el back no marca ninguna como current, nadie es este teléfono', () => {
    const rows = toSessionRows([a, b], { now, timeZone: TZ })
    expect(rows.every((r) => !r.isCurrent && r.title === 'Otro dispositivo')).toBe(true)
  })

  it('el label accesible lee título, inicio y último uso', () => {
    const [row] = toSessionRows([{ ...b, current: true }], { now, timeZone: TZ })
    expect(row.accessibilityLabel).toBe('Este teléfono. Inició el 1 oct 2026. Último uso: hace 1 h.')
  })
})
