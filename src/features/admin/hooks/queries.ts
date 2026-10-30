import { useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/lib/api/endpoints'
import { useSession } from '@/lib/session/SessionContext'
import { queryKeys } from '@/lib/query'
import { adminKeys } from '../queryKeys'
import { sortClosed, TAB_STATUSES, type ReportTab } from '../model/reports'
import { ADMIN_PAGE, appendById, canLoadMore, nextReportCursor, pageMayContinue } from '../model/pages'
import { appendSongs, SONGS_PAGE_CAP } from '../model/songs'
import type {
  AdminEvent,
  AdminEventRequest,
  AdminReport,
  AdminSong,
  AdminSongRequest,
  ReportAction,
  ReportStatus,
  UserStatus,
} from '../types'

const ALL_STATUSES: readonly ReportStatus[] = ['open', 'resolved', 'dismissed']

export function useIsAdmin(): boolean {
  return useSession().user?.role === 'admin'
}

// ---------- Conciertos ----------

export function useAdminEvents() {
  return useQuery({ queryKey: adminKeys.events, queryFn: () => adminApi.events(true, ADMIN_PAGE, 0) })
}

export function useLoadMoreEvents() {
  const queryClient = useQueryClient()
  const loaded = queryClient.getQueryData<AdminEvent[]>(adminKeys.events)?.length ?? 0
  const [endAt, setEndAt] = useState<number | null>(null)
  const mutation = useMutation({
    mutationFn: (offset: number) => adminApi.events(true, ADMIN_PAGE, offset),
    onSuccess: (page, offset) => {
      queryClient.setQueryData<AdminEvent[]>(adminKeys.events, (prev) => appendById(prev, page))
      if (!pageMayContinue(page.length)) setEndAt(offset + page.length)
    },
  })
  return { canLoadMore: canLoadMore(loaded, endAt), loadMore: () => mutation.mutateAsync(loaded), isPending: mutation.isPending }
}

// Un cambio del panel debe verse ya en la pestaña Conciertos (caché pública bajo 'events').
function useRefreshEvents() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.events })
    void queryClient.invalidateQueries({ queryKey: ['events'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.myEvents })
  }
}

export function useSaveEvent(eventId: string | null) {
  const queryClient = useQueryClient()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (body: AdminEventRequest) =>
      eventId ? adminApi.updateEvent(eventId, body) : adminApi.createEvent(body),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminEvent[]>(adminKeys.events, (prev) => {
        if (!prev) return prev
        const rest = prev.filter((e) => e.id !== saved.id)
        return [...rest, saved].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      })
      refresh()
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (eventId: string) => adminApi.deleteEvent(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.setQueryData<AdminEvent[]>(adminKeys.events, (prev) => prev?.filter((e) => e.id !== eventId))
      queryClient.removeQueries({ queryKey: queryKeys.event(eventId) })
      refresh()
    },
  })
}

// ---------- Canciones ----------

export function useAdminSongs() {
  return useQuery({ queryKey: adminKeys.songs, queryFn: () => adminApi.songs(SONGS_PAGE_CAP, 0) })
}

export function useLoadMoreSongs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (offset: number) => adminApi.songs(SONGS_PAGE_CAP, offset),
    onSuccess: (page) => queryClient.setQueryData<AdminSong[]>(adminKeys.songs, (prev) => appendSongs(prev, page)),
  })
}

function upsertSong(prev: AdminSong[] | undefined, saved: AdminSong): AdminSong[] | undefined {
  if (!prev) return prev
  const exists = prev.some((s) => s.id === saved.id)
  return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev]
}

export function useCreateSong() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AdminSongRequest) => adminApi.createSong(body),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminSong[]>(adminKeys.songs, (prev) => upsertSong(prev, saved))
      void queryClient.invalidateQueries({ queryKey: adminKeys.songs })
    },
  })
}

type UpdateSongVars = { id: string; body: AdminSongRequest }

// Optimista: el switch de activa/inactiva responde al instante y vuelve atrás si el back dice que no.
export function useUpdateSong() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: UpdateSongVars) => adminApi.updateSong(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.songs })
      const previous = queryClient.getQueryData<AdminSong[]>(adminKeys.songs)
      queryClient.setQueryData<AdminSong[]>(adminKeys.songs, (prev) =>
        prev?.map((s) => (s.id === id ? { ...s, ...body, previewUrl: body.previewUrl ?? null, iTunesTrackId: body.iTunesTrackId ?? null } : s)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(adminKeys.songs, context.previous)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminSong[]>(adminKeys.songs, (prev) => upsertSong(prev, saved))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.songs })
    },
  })
}

export const MIN_TERM = 2

export function useITunesSearch(term: string) {
  const clean = term.trim()
  return useQuery({
    queryKey: adminKeys.itunes(clean.toLowerCase()),
    queryFn: () => adminApi.searchITunes(clean),
    enabled: clean.length >= MIN_TERM,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------- Reportes ----------

export function useAdminReports(tab: ReportTab) {
  const results = useQueries({
    queries: TAB_STATUSES[tab].map((status) => ({
      queryKey: adminKeys.reports(status),
      queryFn: () => adminApi.reports(status),
    })),
  })
  const isPending = results.some((r) => r.isPending)
  const error = results.find((r) => r.isError)?.error ?? null
  const merged = results.flatMap((r) => r.data ?? [])
  return {
    data: tab === 'closed' ? sortClosed(merged) : merged,
    isPending,
    isError: error !== null,
    error,
    isRefetching: results.some((r) => r.isRefetching),
    refetch: () => Promise.all(results.map((r) => r.refetch())),
  }
}

// "Cargar más" de una pestaña: pide la página siguiente de cada estado que tenga una página completa.
export function useLoadMoreReports(tab: ReportTab) {
  const queryClient = useQueryClient()
  const [endAt, setEndAt] = useState<Partial<Record<ReportStatus, number>>>({})
  const loadedOf = (status: ReportStatus) => queryClient.getQueryData<AdminReport[]>(adminKeys.reports(status)) ?? []
  const pending = TAB_STATUSES[tab].filter((s) => canLoadMore(loadedOf(s).length, endAt[s] ?? null))
  const mutation = useMutation({
    mutationFn: () =>
      Promise.all(
        pending.map(async (status) => {
          const loaded = loadedOf(status)
          const page = await adminApi.reports(status, { ...nextReportCursor(loaded) })
          return { status, page, before: loaded.length }
        }),
      ),
    onSuccess: (results) => {
      for (const { status, page, before } of results) {
        queryClient.setQueryData<AdminReport[]>(adminKeys.reports(status), (prev) => appendById(prev, page))
        if (!pageMayContinue(page.length)) setEndAt((prev) => ({ ...prev, [status]: before + page.length }))
      }
    },
  })
  return { canLoadMore: pending.length > 0, loadMore: () => mutation.mutateAsync(), isPending: mutation.isPending }
}

export function usePendingReportsCount(enabled = true) {
  return useQuery({
    queryKey: adminKeys.reports('open'),
    queryFn: () => adminApi.reports('open'),
    enabled,
    select: (reports: AdminReport[]) => reports.length,
  })
}

// No hay GET por id: se busca en la lista del estado con el que se abrió y, si no está, en las otras.
export function useAdminReport(reportId: string, hint: ReportStatus = 'open') {
  const others = ALL_STATUSES.filter((s) => s !== hint)
  const first = useQuery({ queryKey: adminKeys.reports(hint), queryFn: () => adminApi.reports(hint) })
  const inFirst = first.data?.find((r) => r.id === reportId) ?? null
  const searchOthers = !inFirst && (first.isSuccess || first.isError)
  const rest = useQueries({
    queries: others.map((status) => ({
      queryKey: adminKeys.reports(status),
      queryFn: () => adminApi.reports(status),
      enabled: searchOthers,
    })),
  })
  const report = inFirst ?? rest.flatMap((r) => r.data ?? []).find((r) => r.id === reportId) ?? null
  const all = [first, ...rest]
  return {
    report,
    isPending: !report && (first.isPending || (searchOthers && rest.some((r) => r.isFetching && !r.data))),
    error: report ? null : (all.find((r) => r.isError)?.error ?? null),
    refetch: () => Promise.all(all.map((r) => r.refetch())),
    isRefetching: all.some((r) => r.isRefetching),
  }
}

function patchReportsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (reports: AdminReport[]) => AdminReport[],
) {
  for (const status of ALL_STATUSES) {
    queryClient.setQueryData<AdminReport[]>(adminKeys.reports(status), (prev) => (prev ? update(prev) : prev))
  }
}

type ResolveVars = { reportId: string; action: ReportAction; note: string }

export function useResolveReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, action, note }: ResolveVars) =>
      adminApi.resolveReport(reportId, { action, note: note.trim() || null }),
    onSuccess: (resolved) => {
      // Sale de pendientes y entra en su lista; si fue ban, la cuenta aparece suspendida en todos sus reportes.
      patchReportsCache(queryClient, (list) => list.filter((r) => r.id !== resolved.id))
      queryClient.setQueryData<AdminReport[]>(adminKeys.reports(resolved.status), (prev) =>
        prev ? [resolved, ...prev] : prev,
      )
      const reported = resolved.reported
      if (reported) {
        patchReportsCache(queryClient, (list) =>
          list.map((r) => (r.reported?.id === reported.id ? { ...r, reported: { ...r.reported, status: reported.status } } : r)),
        )
      }
      void queryClient.invalidateQueries({ queryKey: adminKeys.reportsAll })
    },
  })
}

type StatusVars = { userId: string; status: UserStatus }

export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status }: StatusVars) => adminApi.setUserStatus(userId, status),
    onSuccess: (_data, { userId, status }) => {
      const patch = <T extends { id: string; status: UserStatus } | null>(ref: T): T =>
        ref && ref.id === userId ? { ...ref, status } : ref
      patchReportsCache(queryClient, (list) =>
        list.map((r) => ({ ...r, reported: patch(r.reported), reporter: patch(r.reporter) })),
      )
      void queryClient.invalidateQueries({ queryKey: adminKeys.reportsAll })
    },
  })
}
