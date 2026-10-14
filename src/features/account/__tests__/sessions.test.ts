import type { AccountSession } from '@/lib/api/endpoints'
import {
  findCurrentSessionId,
  formatLastUsed,
  formatSessionDate,
  issuedAtOf,
  otherSessionIds,
  toSessionRows,
} from '../sessions'

const b64url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload: object) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma`

const session = (id: string, createdAt: string, lastUsedAt: string): AccountSession => ({
  id,
  createdAt,
  lastUsedAt,
  expiresAt: '2026-12-01T00:00:00Z',
})

const ISSUED = Date.parse('2026-10-14T15:00:00Z') / 1000
const TZ = 'America/Bogota'

describe('issuedAtOf', () => {
  it('lee iat del payload del JWT', () => {
    expect(issuedAtOf(jwt({ sub: 'u', iat: ISSUED }))).toBe(ISSUED)
  })

  it('devuelve null con tokens ausentes, ilegibles o sin iat', () => {
    expect(issuedAtOf(null)).toBeNull()
    expect(issuedAtOf('no-es-un-jwt')).toBeNull()
    expect(issuedAtOf('a.%%%.c')).toBeNull()
    expect(issuedAtOf(jwt({ sub: 'u' }))).toBeNull()
    expect(issuedAtOf(jwt({ iat: 'ayer' }))).toBeNull()
  })
})

describe('findCurrentSessionId', () => {
  const mine = session('mine', '2026-10-01T10:00:00Z', '2026-10-14T14:59:59.800Z')
  const other = session('other', '2026-09-20T10:00:00Z', '2026-10-14T13:00:00Z')

  it('reconoce la sesión cuyo último uso coincide con la emisión del token', () => {
    expect(findCurrentSessionId([other, mine], ISSUED)).toBe('mine')
  })

  it('no adivina si no hay token o ninguna coincide', () => {
    expect(findCurrentSessionId([other, mine], null)).toBeNull()
    expect(findCurrentSessionId([other], ISSUED)).toBeNull()
  })

  it('no adivina si dos sesiones se renovaron en el mismo instante', () => {
    const twin = session('twin', '2026-10-02T10:00:00Z', '2026-10-14T14:59:59.500Z')
    expect(findCurrentSessionId([mine, twin], ISSUED)).toBeNull()
  })

  it('otherSessionIds excluye la actual y no devuelve nada si no se sabe cuál es', () => {
    expect(otherSessionIds([mine, other], 'mine')).toEqual(['other'])
    expect(otherSessionIds([mine, other], null)).toEqual([])
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
  const current = session('c', '2026-08-01T15:00:00Z', '2026-10-14T09:00:00Z')

  it('pone este teléfono primero y el resto por último uso', () => {
    const rows = toSessionRows([a, b, current], 'c', { now, timeZone: TZ })
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(rows[0]).toMatchObject({ isCurrent: true, title: 'Este teléfono' })
    expect(rows[1]).toMatchObject({ isCurrent: false, title: 'Otro dispositivo', lastUsedLabel: 'hace 1 h' })
  })

  it('sin sesión reconocida nadie se marca como este teléfono', () => {
    const rows = toSessionRows([a, b], null, { now, timeZone: TZ })
    expect(rows.every((r) => !r.isCurrent && r.title === 'Otro dispositivo')).toBe(true)
  })

  it('el label accesible lee título, inicio y último uso', () => {
    const [row] = toSessionRows([b], 'b', { now, timeZone: TZ })
    expect(row.accessibilityLabel).toBe('Este teléfono. Inició el 1 oct 2026. Último uso: hace 1 h.')
  })
})
