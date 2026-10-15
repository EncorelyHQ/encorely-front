import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createFakeProfileServer, makeProfile, makeReceived, type FakeProfileServer } from '../__fixtures__/fakeProfileServer'
import { useProfile, useReaction, useReceivedReactions } from '../queries'
import { flattenReceived } from '../received'
import { isProfileGone } from '../errors'

let mockServer: FakeProfileServer

jest.mock('@/lib/api/endpoints', () => ({
  usersApi: {
    profile: (...a: [string]) => mockServer.profile(...a),
    react: (...a: Parameters<FakeProfileServer['react']>) => mockServer.react(...a),
    unreact: (...a: Parameters<FakeProfileServer['unreact']>) => mockServer.unreact(...a),
  },
  meApi: { receivedReactions: (...a: [string?]) => mockServer.receivedReactions(...a) },
}))

const clients: QueryClient[] = []

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  clients.push(client)
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  mockServer = createFakeProfileServer()
  mockServer.addProfile(makeProfile())
})

afterEach(() => {
  for (const client of clients.splice(0)) client.clear()
})

it('useProfile trae el perfil y un perfil oculto queda como no disponible', async () => {
  const wrapper = wrap()
  const { result } = await renderHook(() => useProfile('u2'), { wrapper })
  await waitFor(() => expect(result.current.data?.displayName).toBe('Valentina Rojas'))

  const hidden = await renderHook(() => useProfile('nadie'), { wrapper })
  await waitFor(() => expect(hidden.result.current.isError).toBe(true))
  expect(isProfileGone(hidden.result.current.error)).toBe(true)
})

it('useReaction cambia el sticker al instante, lo guarda y lo deshace si el back falla', async () => {
  const wrapper = wrap()
  const onError = jest.fn()
  const { result } = await renderHook(() => ({ profile: useProfile('u2'), reaction: useReaction('u2', { onError }) }), { wrapper })
  await waitFor(() => expect(result.current.profile.data).toBeDefined())

  await act(async () => {
    await result.current.reaction.mutateAsync({ targetKind: 'genre', targetKey: 'salsa', reaction: 'meToo' })
  })
  expect(result.current.profile.data?.myReactions).toEqual([{ targetKind: 'genre', targetKey: 'salsa', reaction: 'meToo' }])
  expect(mockServer.reactionsOf('u2')).toHaveLength(1)

  mockServer.failNext(429, 'rate_limited')
  await act(async () => {
    await result.current.reaction.mutateAsync({ targetKind: 'genre', targetKey: 'salsa', reaction: 'letsGo' }).catch(() => {})
  })
  expect(result.current.profile.data?.myReactions[0].reaction).toBe('meToo')
  expect(onError).toHaveBeenCalledTimes(1)
})

it('useReaction recarga el perfil si el objetivo ya no está', async () => {
  const wrapper = wrap()
  const { result } = await renderHook(() => ({ profile: useProfile('u2'), reaction: useReaction('u2') }), { wrapper })
  await waitFor(() => expect(result.current.profile.data).toBeDefined())
  await act(async () => {
    await result.current.reaction.mutateAsync({ targetKind: 'artist', targetKey: 'karol-g', reaction: 'meToo' }).catch(() => {})
  })
  await waitFor(() => expect(mockServer.calls.filter((c) => c === 'GET profile u2')).toHaveLength(2))
  expect(result.current.profile.data?.myReactions).toEqual([])
})

it('useReceivedReactions pagina con nextCursor hasta el final', async () => {
  mockServer.setReceived(Array.from({ length: 45 }, (_, i) => makeReceived(i)))
  const { result } = await renderHook(() => useReceivedReactions(), { wrapper: wrap() })
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
  expect(result.current.hasNextPage).toBe(true)

  for (const pages of [2, 3]) {
    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(pages))
  }
  expect(flattenReceived(result.current.data?.pages)).toHaveLength(45)
  expect(result.current.hasNextPage).toBe(false)
  expect(mockServer.calls).toEqual(['GET received -', `GET received ${btoa('20')}`, `GET received ${btoa('40')}`])
})
