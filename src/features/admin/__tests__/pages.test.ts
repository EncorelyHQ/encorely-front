import { appendById, canLoadMore, nextReportCursor, pageMayContinue } from '../model/pages'

describe('paginación del panel (draft.16)', () => {
  it('solo ofrece más con páginas completas y hasta llegar al final', () => {
    expect(canLoadMore(0, null)).toBe(false)
    expect(canLoadMore(50, null)).toBe(false)
    expect(canLoadMore(200, null)).toBe(true)
    expect(canLoadMore(400, 400)).toBe(false)
    expect(pageMayContinue(200)).toBe(true)
    expect(pageMayContinue(7)).toBe(false)
  })

  it('pega sin repetir ids', () => {
    expect(appendById([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('el cursor de reportes es el último por fecha y luego por id, aunque la caché esté desordenada', () => {
    const list = [
      { id: 'c', createdAt: '2026-10-15T10:00:00Z' },
      { id: 'b', createdAt: '2026-10-15T12:00:00Z' },
      { id: 'a', createdAt: '2026-10-15T12:00:00Z' },
    ]
    expect(nextReportCursor(list)).toEqual({ afterAt: '2026-10-15T12:00:00Z', afterId: 'b' })
    expect(nextReportCursor([])).toBeNull()
  })
})
