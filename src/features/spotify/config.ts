import * as AuthSession from 'expo-auth-session'
import Constants from 'expo-constants'

export const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com'
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

// Solo leemos el top de artistas: cada permiso extra alarga la pantalla de consentimiento y no se usaría.
export const SPOTIFY_SCOPES = ['user-top-read'] as const
// Para entrar solo hace falta el correo: el back canjea el code y lee /v1/me para crear o encontrar la cuenta.
export const SPOTIFY_LOGIN_SCOPES = ['user-read-email'] as const

// Límites del contrato POST /me/spotify/import (MusicContracts.cs): 50 artistas, nombre ≤200, ≤20 géneros.
export const MAX_IMPORT_ARTISTS = 50
export const MAX_ARTIST_NAME = 200
export const MAX_ARTIST_GENRES = 20

export const SPOTIFY_TIMEOUT_MS = 15_000

export function getSpotifyClientId(): string {
  const extra = Constants.expoConfig?.extra as { spotifyClientId?: unknown } | undefined
  return typeof extra?.spotifyClientId === 'string' ? extra.spotifyClientId.trim() : ''
}

// Spotify compara la redirect URI carácter por carácter con la del Dashboard: sin barra final.
export function getSpotifyRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'encorely', path: 'spotify-callback' }).replace(/\/+$/, '')
}
