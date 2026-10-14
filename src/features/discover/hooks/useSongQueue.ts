import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import type { Dna, Song, SwipeDirection } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useToast } from '@/ui'
import { FEED_PAGE, initialQueue, queueReducer, shouldPrefetch, shouldRequeue } from '../model/queue'
import { applySwipeResult } from '../model/radar'

type SwipeVars = { song: Song; direction: SwipeDirection }

type Options = { onRadarUnlocked: () => void }

export function useSongQueue({ onRadarUnlocked }: Options) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [state, dispatch] = useReducer(queueReducer, initialQueue)

  const feed = useQuery({
    queryKey: queryKeys.feed,
    queryFn: () => catalogApi.feed(FEED_PAGE),
    // La cola local es la fuente de verdad mientras se califica: refrescar solo cuando la pedimos.
    staleTime: Infinity,
    // Sin caché entre montajes: una tanda vieja traería canciones que ya calificaste.
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

  // `dataUpdatedAt` cambia en cada respuesta aunque el contenido sea idéntico (structural sharing conserva la referencia).
  const { data, dataUpdatedAt } = feed
  useEffect(() => {
    if (data) dispatch({ type: 'received', songs: data })
  }, [data, dataUpdatedAt])

  // Si una precarga falla no se reintenta en bucle: se vuelve a intentar cuando el usuario califica otra canción.
  const failedAtLength = useRef<number | null>(null)
  const { refetch, isFetching } = feed
  const remaining = state.items.length
  const wantsMore = data !== undefined && shouldPrefetch(state)
  useEffect(() => {
    if (!wantsMore || isFetching || failedAtLength.current === remaining) return
    void refetch().then((result) => {
      failedAtLength.current = result.isError ? remaining : null
    })
  }, [wantsMore, isFetching, remaining, refetch])

  const unlockedRef = useRef(onRadarUnlocked)
  useEffect(() => {
    unlockedRef.current = onRadarUnlocked
  }, [onRadarUnlocked])

  const swipe = useMutation({
    mutationFn: ({ song, direction }: SwipeVars) => catalogApi.swipe(song.id, direction),
    onSuccess: (result) => {
      const dna = queryClient.getQueryData<Dna>(queryKeys.dna)
      if (!dna) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.dna })
        return
      }
      const { next, unlockedNow } = applySwipeResult(dna, result)
      queryClient.setQueryData(queryKeys.dna, next)
      if (unlockedNow) {
        // El servidor manda: confirmamos el desbloqueo y los pesos de géneros con un GET real.
        void queryClient.invalidateQueries({ queryKey: queryKeys.dna })
        unlockedRef.current()
      } else {
        // Los pesos de géneros cambiaron: que el perfil los recargue cuando se abra, sin un GET por cada swipe.
        void queryClient.invalidateQueries({ queryKey: queryKeys.dna, refetchType: 'none' })
      }
    },
    onError: (error, { song }) => {
      const requeue = shouldRequeue(error)
      if (requeue) dispatch({ type: 'failed', song })
      const tail = requeue ? `Te volvemos a mostrar "${song.title}" al final.` : `No guardamos tu calificación de "${song.title}".`
      toast.show(`${userMessage(error)} ${tail}`, 'danger')
    },
  })

  const { mutate } = swipe
  const decide = useCallback(
    (song: Song, direction: SwipeDirection) => {
      // Optimista: la tarjeta sale ya y el POST corre detrás.
      dispatch({ type: 'decided', songId: song.id })
      mutate({ song, direction })
    },
    [mutate],
  )

  return {
    items: state.items,
    exhausted: state.exhausted,
    decide,
    isLoading: feed.isPending,
    error: feed.isError && state.items.length === 0 ? feed.error : null,
    isFetching,
    reload: () => {
      failedAtLength.current = null
      void refetch()
    },
  }
}
