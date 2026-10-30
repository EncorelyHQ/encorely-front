import { parseEvidence } from '../model/evidence'

const p = (inner: Record<string, unknown>) => JSON.stringify(inner)

describe('parseEvidence', () => {
  it('saca el cuerpo (b), la hora (t) y el remitente (s) de un p válido', () => {
    const plaintext = p({ v: 1, id: 'm1', m: 'match', s: 'user-a', r: 'user-b', t: 1_790_000_000_000, k: 'text', b: 'Hola, ¿vas?' })
    expect(parseEvidence(plaintext)).toEqual({
      kind: 'message',
      body: 'Hola, ¿vas?',
      sentAt: 1_790_000_000_000,
      senderId: 'user-a',
    })
  })

  it('acepta un cuerpo vacío y campos opcionales ausentes', () => {
    expect(parseEvidence(p({ b: '' }))).toEqual({ kind: 'message', body: '', sentAt: null, senderId: null })
  })

  it('un JSON sin b no se muestra (nunca el JSON crudo)', () => {
    expect(parseEvidence(p({ v: 1, id: 'm1', t: 1 }))).toEqual({ kind: 'unreadable' })
    expect(parseEvidence(p({ b: 42 }))).toEqual({ kind: 'unreadable' })
    expect(parseEvidence('[1,2]')).toEqual({ kind: 'unreadable' })
    expect(parseEvidence('null')).toEqual({ kind: 'unreadable' })
  })

  it('un JSON roto tampoco se expone', () => {
    expect(parseEvidence('{"b":"hola"')).toEqual({ kind: 'unreadable' })
    expect(parseEvidence('')).toEqual({ kind: 'unreadable' })
  })

  it('texto plano de un cliente viejo se muestra tal cual', () => {
    expect(parseEvidence('  hola  ')).toEqual({ kind: 'message', body: 'hola', sentAt: null, senderId: null })
  })

  it('ignora una hora que no es número', () => {
    expect(parseEvidence(p({ b: 'x', t: '2026' }))).toMatchObject({ sentAt: null })
  })
})
