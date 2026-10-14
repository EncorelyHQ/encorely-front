export type PushPayload = { t: 'chat' | 'match'; matchId?: string }

// The id ends up in a route path: anything that is not a plain id is dropped instead of navigated to.
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/

export function parsePushData(data: unknown): PushPayload | null {
  if (typeof data !== 'object' || data === null) return null
  const { t, matchId } = data as Record<string, unknown>
  if (t !== 'chat' && t !== 'match') return null
  const id = typeof matchId === 'string' && SAFE_ID.test(matchId) ? matchId : undefined
  return id ? { t, matchId: id } : { t }
}

export function routeForPush(data: unknown): string | null {
  const payload = parsePushData(data)
  if (!payload) return null
  if (payload.t === 'chat' && payload.matchId) return `/chat/${payload.matchId}`
  return '/chats'
}
