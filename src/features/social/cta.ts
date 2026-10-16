import type { PublicProfile } from '@/lib/api/types'

export type ProfileCta = 'none' | 'write' | 'liked' | 'like' | 'noSharedEvent'

// draft.15: matched = hay match activo; likedByMe = ya le di like (haya o no match). Mismo significado que en el radar.
// draft.17: canLike = el like respondería 200 ahora (comparten un concierto vigente). Sin eso, POST /likes da 403.
export function profileCta(profile: Pick<PublicProfile, 'matched' | 'likedByMe' | 'canLike'>, own: boolean): ProfileCta {
  if (own) return 'none'
  if (profile.matched) return 'write'
  if (profile.likedByMe) return 'liked'
  return profile.canLike ? 'like' : 'noSharedEvent'
}
