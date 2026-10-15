import type { PublicProfile } from '@/lib/api/types'

export type ProfileCta = 'none' | 'write' | 'liked' | 'like'

// draft.15: matched = hay match activo; likedByMe = ya le di like (haya o no match). Mismo significado que en el radar.
export function profileCta(profile: Pick<PublicProfile, 'matched' | 'likedByMe'>, own: boolean): ProfileCta {
  if (own) return 'none'
  if (profile.matched) return 'write'
  return profile.likedByMe ? 'liked' : 'like'
}
