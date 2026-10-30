import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import type { PublicProfile } from '@/lib/api/types'
import { PROFILE_UNAVAILABLE, socialErrorMessage } from '../errors'
import { applyReaction, reactionFor, reactionMutationOptions } from '../reactions'
import { flattenReceived } from '../received'
import { makeProfile, makeReceived } from '../__fixtures__/fakeProfileServer'

const salsa = { targetKind: 'genre', targetKey: 'salsa' } as const
const bomba = { targetKind: 'artist', targetKey: 'bomba-estereo' } as const

describe('applyReaction', () => {
  it('pone, reemplaza y quita una sola reacción por objetivo', () => {
    let p = applyReaction(makeProfile(), { ...salsa, reaction: 'meToo' })
    p = applyReaction(p, { ...bomba, reaction: 'letsGo' })
    p = applyReaction(p, { ...salsa, reaction: 'sendOne' })
    expect(p.myReactions).toHaveLength(2)
    expect(reactionFor(p, salsa)).toBe('sendOne')
    p = applyReaction(p, { ...salsa, reaction: null })
    expect(reactionFor(p, salsa)).toBeNull()
    expect(reactionFor(p, bomba)).toBe('letsGo')
  })

  it('distingue género y artista con la misma clave', () => {
    const p = applyReaction(makeProfile(), { targetKind: 'artist', targetKey: 'salsa', reaction: 'meToo' })
    expect(reactionFor(p, salsa)).toBeNull()
  })
})

describe('reacción optimista', () => {
  const setup = (profile: PublicProfile = makeProfile()) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    qc.setQueryData(queryKeys.profile('u2'), profile)
    const deps = { react: jest.fn().mockResolvedValue(undefined), unreact: jest.fn().mockResolvedValue(undefined), onError: jest.fn() }
    return { qc, deps, opts: reactionMutationOptions(qc, 'u2', deps), read: () => qc.getQueryData<PublicProfile>(queryKeys.profile('u2'))! }
  }

  it('marca el sticker antes de la respuesta', async () => {
    const { opts, read } = setup()
    await opts.onMutate({ ...salsa, reaction: 'letsGo' })
    expect(reactionFor(read(), salsa)).toBe('letsGo')
  })

  it('si falla, vuelve a la reacción anterior de ese objetivo y no toca las demás', async () => {
    const { qc, opts, deps, read } = setup(makeProfile({ myReactions: [{ ...salsa, reaction: 'meToo' }] }))
    const ctx = await opts.onMutate({ ...salsa, reaction: 'sendOne' })
    // Mientras tanto otra reacción sí salió.
    qc.setQueryData(queryKeys.profile('u2'), applyReaction(read(), { ...bomba, reaction: 'letsGo' }))
    const error = new ApiError('network', 'offline')
    opts.onError(error, { ...salsa, reaction: 'sendOne' }, ctx)
    expect(reactionFor(read(), salsa)).toBe('meToo')
    expect(reactionFor(read(), bomba)).toBe('letsGo')
    expect(deps.onError).toHaveBeenCalledWith(error)
  })

  it('vuelve a pedir el perfil si el objetivo ya no está o el perfil dejó de verse', async () => {
    for (const [status, code] of [
      [400, 'reaction_target_not_found'],
      [404, 'user_not_found'],
    ] as const) {
      const { qc, opts } = setup()
      const spy = jest.spyOn(qc, 'invalidateQueries')
      const ctx = await opts.onMutate({ ...salsa, reaction: 'meToo' })
      opts.onError(new ApiError('http', code, { status, code }), { ...salsa, reaction: 'meToo' }, ctx)
      expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.profile('u2') })
    }
  })

  it('PUT para poner, DELETE para quitar', () => {
    const { opts, deps } = setup()
    void opts.mutationFn({ ...salsa, reaction: 'meToo' })
    void opts.mutationFn({ ...bomba, reaction: null })
    expect(deps.react).toHaveBeenCalledWith('u2', { ...salsa, reaction: 'meToo' })
    expect(deps.unreact).toHaveBeenCalledWith('u2', 'artist', 'bomba-estereo')
  })
})

describe('flattenReceived', () => {
  it('une las páginas y deja la primera aparición de cada persona y objetivo', () => {
    const pages = [
      { items: [makeReceived(1, { reaction: 'letsGo' }), makeReceived(2)], nextCursor: 'x' },
      { items: [makeReceived(1), makeReceived(1, { targetKey: 'rock' })], nextCursor: null },
    ]
    const flat = flattenReceived(pages)
    expect(flat.map((r) => `${r.from.userId}:${r.targetKey}:${r.reaction}`)).toEqual(['p1:salsa:letsGo', 'p2:salsa:meToo', 'p1:rock:meToo'])
  })
})

describe('socialErrorMessage', () => {
  it('no dice por qué un perfil no está disponible', () => {
    expect(socialErrorMessage(new ApiError('http', 'x', { status: 404, code: 'user_not_found' }))).toBe(PROFILE_UNAVAILABLE)
    expect(socialErrorMessage(new ApiError('http', 'x', { status: 404 }))).toBe(PROFILE_UNAVAILABLE)
  })

  it('explica cuando el objetivo salió del perfil y deja el resto al mensaje general', () => {
    expect(socialErrorMessage(new ApiError('http', 'x', { status: 400, code: 'reaction_target_not_found' }))).toMatch(/ya no está/)
    expect(socialErrorMessage(new ApiError('network', 'x'))).toMatch(/Sin conexión/)
  })
})
