import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { meApi } from '@/lib/api/endpoints'
import type { Dna } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useSession } from '@/lib/session/SessionContext'
import { isSpotifyError, SpotifyError, spotifyUserMessage, type SpotifyErrorKind } from './errors'
import { allGenresUnmapped, getTopArtists, toImportPayload } from './spotifyApi'
import {
  authorizeWithSpotify,
  completeAuthorizationRedirect,
  refreshAccessToken,
  type AuthorizationParams,
  type SpotifyTokens,
} from './spotifyAuth'
import { clearRefreshToken, ensureSpotifyCleanup, loadRefreshToken, saveRefreshToken } from './storage'

ensureSpotifyCleanup()

export type SpotifyImportStatus = 'idle' | 'authorizing' | 'importing' | 'done' | 'error'

// dnaUnchanged: ningún género de esos artistas aportó al ADN (el back los devolvió todos en unmappedGenres).
export type SpotifyImportResult = { count: number; dna: Dna; dnaUnchanged: boolean }

type Source = { kind: 'connect' } | { kind: 'redirect'; params: AuthorizationParams }

type Options = { onImported?: (result: SpotifyImportResult) => void }

export function useSpotifyImport({ onImported }: Options = {}) {
  const { user } = useSession()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<'authorizing' | 'importing'>('authorizing')
  // Usuario para el que hay un refresh token guardado; atado al id para no heredar el estado de otra cuenta.
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null)
  const isLinked = userId !== null && linkedUserId === userId
  // Dos toques seguidos llegan antes del re-render que deshabilita el botón: el ref corta el segundo.
  const busy = useRef(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void loadRefreshToken(userId).then((token) => {
      if (!cancelled) setLinkedUserId(token !== null ? userId : null)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const keepRefreshToken = useCallback(async (uid: string, tokens: SpotifyTokens) => {
    if (!tokens.refreshToken) return
    try {
      await saveRefreshToken(uid, tokens.refreshToken)
      setLinkedUserId(uid)
    } catch {
      // Sin llavero disponible solo se pierde el atajo: la próxima vez se vuelve a pedir permiso en Spotify.
    }
  }, [])

  const forgetLink = useCallback(async (uid: string) => {
    await clearRefreshToken(uid)
    setLinkedUserId(null)
  }, [])

  const obtainAccessToken = useCallback(
    async (uid: string, source: Source): Promise<string | null> => {
      if (source.kind === 'redirect') {
        setPhase('importing')
        const tokens = await completeAuthorizationRedirect(uid, source.params)
        if (!tokens) return null
        await keepRefreshToken(uid, tokens)
        return tokens.accessToken
      }

      const stored = await loadRefreshToken(uid)
      if (stored) {
        setPhase('importing')
        try {
          const tokens = await refreshAccessToken(stored)
          await keepRefreshToken(uid, tokens)
          return tokens.accessToken
        } catch (error) {
          // Solo un permiso revocado o vencido justifica volver a pedir consentimiento; sin red se reintenta igual.
          if (!isSpotifyError(error, 'auth')) throw error
          await forgetLink(uid)
        }
      }

      setPhase('authorizing')
      const tokens = await authorizeWithSpotify(uid)
      setPhase('importing')
      await keepRefreshToken(uid, tokens)
      return tokens.accessToken
    },
    [forgetLink, keepRefreshToken],
  )

  const mutation = useMutation({
    mutationFn: async (source: Source): Promise<SpotifyImportResult | null> => {
      if (!userId) throw new Error('Spotify import without session')
      const accessToken = await obtainAccessToken(userId, source)
      if (!accessToken) return null

      let items: unknown[]
      try {
        items = await getTopArtists(accessToken)
      } catch (error) {
        // Un acceso que Spotify ya no acepta (cuenta fuera de la lista de prueba o permiso revocado) no se guarda.
        if (isSpotifyError(error, 'devMode') || isSpotifyError(error, 'auth')) await forgetLink(userId)
        throw error
      }

      const payload = toImportPayload(items)
      if (payload.topArtists.length === 0) throw new SpotifyError('empty')
      const { unmappedGenres, ...dna } = await meApi.importSpotify(payload)
      return { count: payload.topArtists.length, dna, dnaUnchanged: allGenresUnmapped(payload, unmappedGenres) }
    },
    onSuccess: (result) => {
      if (!result) return
      queryClient.setQueryData(queryKeys.dna, result.dna)
      void queryClient.invalidateQueries({ queryKey: queryKeys.dna })
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      onImported?.(result)
    },
    onSettled: () => {
      busy.current = false
    },
  })

  const { mutate, reset } = mutation

  const connect = useCallback(() => {
    if (busy.current) return
    busy.current = true
    mutate({ kind: 'connect' })
  }, [mutate])

  // Para la ruta /spotify-callback cuando Android mató la app mientras el usuario estaba en Spotify.
  const resume = useCallback(
    (params: AuthorizationParams) => {
      if (busy.current) return
      busy.current = true
      mutate({ kind: 'redirect', params })
    },
    [mutate],
  )

  const disconnect = useCallback(async () => {
    if (userId) await forgetLink(userId)
    reset()
  }, [forgetLink, reset, userId])

  const status: SpotifyImportStatus = mutation.isPending
    ? phase
    : mutation.isError
      ? 'error'
      : mutation.isSuccess && mutation.data
        ? 'done'
        : 'idle'

  const errorKind: SpotifyErrorKind | 'api' | null = mutation.error
    ? isSpotifyError(mutation.error)
      ? mutation.error.kind
      : 'api'
    : null

  return {
    status,
    importedCount: mutation.data?.count ?? null,
    dnaUnchanged: mutation.data?.dnaUnchanged ?? false,
    errorMessage: mutation.error ? spotifyUserMessage(mutation.error) : null,
    errorKind,
    isLinked,
    connect,
    resume,
    disconnect,
    reset,
  }
}
