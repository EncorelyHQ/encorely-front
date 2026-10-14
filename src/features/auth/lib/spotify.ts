import type { SpotifyLoginGrant } from '@/features/spotify'
import type { SpotifyLoginRequest } from '@/lib/api/types'

// Con versión de términos es porque la persona marcó la casilla antes de abrir Spotify.
export function toSpotifyLoginRequest(grant: SpotifyLoginGrant): SpotifyLoginRequest {
  return {
    code: grant.code,
    codeVerifier: grant.codeVerifier,
    redirectUri: grant.redirectUri,
    acceptTerms: grant.consentVersion !== null,
    consentVersion: grant.consentVersion,
  }
}
