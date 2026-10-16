import { ApiError } from '@/lib/api/errors'
import type { PublicProfile, ReactionRequest, ReactionTargetKind, ReceivedReaction, ReceivedReactionPage } from '@/lib/api/types'

export const makeProfile = (over: Partial<PublicProfile> = {}): PublicProfile => ({
  id: 'u2',
  displayName: 'Valentina Rojas',
  age: 26,
  city: 'Medellín',
  bio: null,
  genres: [{ slug: 'salsa', name: 'Salsa' }],
  artists: [{ key: 'bomba-estereo', name: 'Bomba Estéreo', imageUrl: null, shared: true }],
  stats: { swipeCount: 120, genresExplored: 9, eventsMarked: 3 },
  common: { affinity: 80, sharedGenres: ['salsa'], sharedArtists: ['bomba-estereo'] },
  myReactions: [],
  likedByMe: false,
  matched: false,
  canLike: true,
  ...over,
})

export const makeReceived = (i: number, over: Partial<ReceivedReaction> = {}): ReceivedReaction => ({
  from: { userId: `p${i}`, displayName: `Persona ${i}` },
  targetKind: 'genre',
  targetKey: 'salsa',
  targetName: 'Salsa',
  reaction: 'meToo',
  reactedAt: new Date(Date.UTC(2026, 9, 14, 12, 0, 60 - i)).toISOString(),
  ...over,
})

const httpError = (status: number, code: string) => new ApiError('http', code, { status, code })

// Mismas reglas que el draft.11: 404 sin perfil visible, 400 si el objetivo no está en el perfil, cursor opaco.
export function createFakeProfileServer() {
  const profiles = new Map<string, PublicProfile>()
  let received: ReceivedReaction[] = []
  let failNext: ApiError | null = null
  const calls: string[] = []

  const take = () => {
    const error = failNext
    failNext = null
    if (error) throw error
  }
  const visible = (userId: string) => {
    const profile = profiles.get(userId)
    if (!profile) throw httpError(404, 'user_not_found')
    return profile
  }

  return {
    calls,
    addProfile: (profile: PublicProfile) => profiles.set(profile.id, profile),
    hide: (userId: string) => profiles.delete(userId),
    setReceived: (items: ReceivedReaction[]) => {
      received = items
    },
    failNext: (status: number, code: string) => {
      failNext = httpError(status, code)
    },
    reactionsOf: (userId: string) => profiles.get(userId)?.myReactions ?? [],

    profile: async (userId: string) => {
      calls.push(`GET profile ${userId}`)
      take()
      return structuredClone(visible(userId))
    },
    react: async (userId: string, body: ReactionRequest) => {
      calls.push(`PUT ${userId} ${body.targetKey} ${body.reaction}`)
      take()
      const profile = visible(userId)
      const list = body.targetKind === 'genre' ? profile.genres.map((g) => g.slug) : profile.artists.map((a) => a.key)
      if (!list.includes(body.targetKey)) throw httpError(400, 'reaction_target_not_found')
      profile.myReactions = [
        ...profile.myReactions.filter((r) => !(r.targetKind === body.targetKind && r.targetKey === body.targetKey)),
        body,
      ]
    },
    unreact: async (userId: string, targetKind: ReactionTargetKind, targetKey: string) => {
      calls.push(`DELETE ${userId} ${targetKey}`)
      take()
      const profile = profiles.get(userId)
      if (profile) profile.myReactions = profile.myReactions.filter((r) => !(r.targetKind === targetKind && r.targetKey === targetKey))
    },
    receivedReactions: async (before?: string, limit = 20): Promise<ReceivedReactionPage> => {
      calls.push(`GET received ${before ?? '-'}`)
      take()
      const start = before ? Number(atob(before)) : 0
      if (Number.isNaN(start)) throw httpError(400, 'validation_failed')
      const items = received.slice(start, start + limit)
      const next = start + limit
      return { items, nextCursor: next < received.length ? btoa(String(next)) : null }
    },
  }
}

export type FakeProfileServer = ReturnType<typeof createFakeProfileServer>
