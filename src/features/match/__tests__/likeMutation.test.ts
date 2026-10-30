import { QueryClient } from '@tanstack/react-query'
import type { RadarPerson } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { makePerson } from '@/features/events/__fixtures__/events'
import { matchReason } from '../copy'
import { likeMutationOptions } from '../likeMutation'

const ana = makePerson()
const luis = makePerson({ userId: 'u2', displayName: 'Luis' })

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  qc.setQueryData(queryKeys.radar('e1'), [ana, luis])
  const deps = { like: jest.fn(), onMatched: jest.fn(), onLiked: jest.fn(), onError: jest.fn() }
  return { qc, deps, opts: likeMutationOptions(qc, 'e1', deps) }
}

const radar = (qc: QueryClient) => qc.getQueryData<RadarPerson[]>(queryKeys.radar('e1'))!

describe('like optimista', () => {
  it('marca "Te interesa" al instante solo en esa persona', async () => {
    const { qc, opts } = setup()
    await opts.onMutate(ana)
    expect(radar(qc)[0].likedByMe).toBe(true)
    expect(radar(qc)[1].likedByMe).toBe(false)
  })

  it('manda el evento como contexto del like', () => {
    const { deps, opts } = setup()
    void opts.mutationFn(ana)
    expect(deps.like).toHaveBeenCalledWith('u1', 'e1')
  })

  it('sin match: queda el interés y no toca /matches', async () => {
    const { qc, deps, opts } = setup()
    const invalidate = jest.spyOn(qc, 'invalidateQueries')
    await opts.onMutate(ana)
    opts.onSuccess({ matched: false, matchId: null }, ana)
    expect(deps.onLiked).toHaveBeenCalledWith(ana)
    expect(deps.onMatched).not.toHaveBeenCalled()
    expect(radar(qc)[0]).toMatchObject({ likedByMe: true, matched: false })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('con match: marca matched, invalida /matches y abre el momento del match', async () => {
    const { qc, deps, opts } = setup()
    const invalidate = jest.spyOn(qc, 'invalidateQueries')
    await opts.onMutate(ana)
    opts.onSuccess({ matched: true, matchId: 'm1' }, ana)
    expect(radar(qc)[0]).toMatchObject({ likedByMe: true, matched: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.matches })
    expect(deps.onMatched).toHaveBeenCalledWith('m1', ana)
  })

  it('si falla, vuelve al estado anterior y avisa', async () => {
    const { qc, deps, opts } = setup()
    const ctx = await opts.onMutate(ana)
    const error = new Error('403')
    opts.onError(error, ana, ctx)
    expect(radar(qc)[0].likedByMe).toBe(false)
    expect(deps.onError).toHaveBeenCalledWith(error, ana)
  })
})

describe('matchReason', () => {
  it('solo dice lo que se sabe', () => {
    expect(matchReason('Andrés Cepeda', 'salsa y rock')).toBe('Los dos van a Andrés Cepeda y les gusta salsa y rock.')
    expect(matchReason('Andrés Cepeda', '')).toBe('Los dos van a Andrés Cepeda.')
    expect(matchReason(null, 'salsa')).toBe('A los dos les gusta salsa.')
    expect(matchReason(undefined, '')).toBe('Ya pueden escribirse.')
  })
})
