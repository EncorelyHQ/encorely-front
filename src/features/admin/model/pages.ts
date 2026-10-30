// Paginación del panel (draft.12 canciones, draft.16 eventos y reportes). Se pide la página más grande que acepta el
// back (200) y lo siguiente se pega a la misma caché plana, así las mutaciones optimistas no cambian.
export const ADMIN_PAGE = 200

// Una página completa puede tener más detrás; una incompleta es la última.
export const pageMayContinue = (pageSize: number) => pageSize >= ADMIN_PAGE

// endAt: el total con el que una página llegó incompleta. Un refetch vuelve a la primera página y cambia el total.
export function canLoadMore(loaded: number, endAt: number | null): boolean {
  return loaded > 0 && loaded % ADMIN_PAGE === 0 && endAt !== loaded
}

// Pega la página siguiente sin repetir: si algo entró mientras tanto, la página se corre.
export function appendById<T extends { id: string }>(prev: readonly T[] | undefined, page: readonly T[]): T[] {
  const list = [...(prev ?? [])]
  const seen = new Set(list.map((item) => item.id))
  for (const item of page) if (!seen.has(item.id)) list.push(item)
  return list
}

// Cursor de /admin/reports: el último por (createdAt, id). Se calcula sobre la caché y no sobre la última página,
// porque moderar mueve reportes entre listas.
export function nextReportCursor(list: readonly { id: string; createdAt: string }[]): { afterAt: string; afterId: string } | null {
  let last: { id: string; createdAt: string } | null = null
  for (const r of list) {
    if (!last || r.createdAt > last.createdAt || (r.createdAt === last.createdAt && r.id > last.id)) last = r
  }
  return last ? { afterAt: last.createdAt, afterId: last.id } : null
}
