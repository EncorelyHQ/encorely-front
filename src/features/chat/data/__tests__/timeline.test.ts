import { applyPage, emptyConversation, mergeMessages, withPending, type ChatMessage } from '../messages'
import { buildTimeline, GROUP_WINDOW_MS } from '../timeline'

const ANA = 'ana'
const BRUNO = 'bruno'
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const NOW = at(14, 20)

let n = 0
function msg(senderId: string, time: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  n += 1
  return { id: `m${n}`, seq: n, senderId, mine: senderId === ANA, at: time, status: 'sent', body: `t${n}`, ...extra }
}

const shape = (rows: ReturnType<typeof buildTimeline>) =>
  rows.map((r) =>
    r.kind === 'message' ? `${r.message.senderId}${r.firstInGroup ? '[' : ''}${r.lastInGroup ? ']' : ''}` : r.kind === 'day' ? `day:${r.label}` : r.kind,
  )

describe('buildTimeline', () => {
  beforeEach(() => {
    n = 0
  })

  test('agrupa mensajes seguidos del mismo autor y separa por día', () => {
    const messages = [
      msg(BRUNO, at(12, 21, 0)),
      msg(BRUNO, at(13, 9, 0)),
      msg(BRUNO, at(13, 9, 2)),
      msg(ANA, at(13, 9, 3)),
      msg(ANA, at(14, 19, 0)),
      msg(ANA, at(14, 19, 1)),
      msg(ANA, at(14, 19, 1) + GROUP_WINDOW_MS + 1),
    ]
    const rows = buildTimeline(messages, { now: NOW, showIntro: false, showKeyChange: false })
    expect(shape(rows)).toEqual([
      expect.stringMatching(/^day:/),
      'bruno[]',
      'day:Ayer',
      'bruno[',
      'bruno]',
      'ana[]',
      'day:Hoy',
      'ana[',
      'ana]',
      // Más de 5 minutos después: grupo nuevo aunque sea la misma persona.
      'ana[]',
    ])
    const firstDay = rows[0]
    expect(firstDay.kind === 'day' && firstDay.label).toMatch(/^Lunes$/)
  })

  test('fechas de hace más de una semana van con día y mes', () => {
    const rows = buildTimeline([msg(BRUNO, at(1, 10))], { now: NOW, showIntro: false, showKeyChange: false })
    const day = rows[0]
    expect(day.kind).toBe('day')
    expect(day.kind === 'day' && day.label).toMatch(/^1 (de )?oct$/)
  })

  test('el inicio del match va primero (solo sin más historial) y el cambio de llave al final', () => {
    const rows = buildTimeline([msg(BRUNO, at(14, 10))], { now: NOW, showIntro: true, showKeyChange: true })
    expect(shape(rows)).toEqual(['matchIntro', 'day:Hoy', 'bruno[]', 'keyChange'])
    expect(shape(buildTimeline([], { now: NOW, showIntro: true, showKeyChange: false }))).toEqual(['matchIntro'])
  })

  test('un mensaje no descifrable no se agrupa con los vecinos', () => {
    const rows = buildTimeline(
      [msg(BRUNO, at(14, 10, 0)), msg(BRUNO, at(14, 10, 1), { status: 'undecryptable', body: null }), msg(BRUNO, at(14, 10, 2))],
      { now: NOW, showIntro: false, showKeyChange: false },
    )
    expect(shape(rows)).toEqual(['day:Hoy', 'bruno[]', 'bruno[]', 'bruno[]'])
  })
})

describe('messages', () => {
  beforeEach(() => {
    n = 0
  })

  test('merge idempotente por id y ordenado por seq; lo descifrado no se degrada', () => {
    const a = msg(ANA, at(14, 9))
    const b = msg(BRUNO, at(14, 10))
    const merged = mergeMessages([b], [a, b, { ...a, status: 'undecryptable', body: null }])
    expect(merged.map((m) => [m.id, m.status])).toEqual([
      [a.id, 'sent'],
      [b.id, 'sent'],
    ])
  })

  test('applyPage calcula cursores y solo la paginación hacia atrás cambia hasMore', () => {
    const first = applyPage(emptyConversation, [msg(ANA, 1), msg(ANA, 2)], 'initial', 1)
    expect(first).toMatchObject({ oldestSeq: 1, newestSeq: 2, hasMore: true })
    const newer = applyPage(first, [msg(ANA, 3)], 'newer', null)
    expect(newer).toMatchObject({ oldestSeq: 1, newestSeq: 3, hasMore: true })
    expect(applyPage(newer, [], 'older', null).hasMore).toBe(false)
  })

  test('los pendientes van al final y desaparecen cuando el servidor confirma el mismo id', () => {
    const confirmed = [msg(ANA, at(14, 9))]
    const pending: ChatMessage = { ...msg(ANA, at(14, 9, 1)), seq: null, status: 'sending' }
    expect(withPending(confirmed, [pending]).map((m) => m.id)).toEqual([confirmed[0].id, pending.id])
    expect(withPending([...confirmed, { ...pending, seq: 9, status: 'sent' }], [pending])).toHaveLength(2)
  })
})
