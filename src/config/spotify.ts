import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';

export const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export const SPOTIFY_SWIPE_MARKET = 'US';
export const SPOTIFY_FALLBACK_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M';
export const SPOTIFY_SWIPE_MIN_VALID_TRACKS = 5;

type SpotifyExtra = {
  spotifyClientId?: string;
  spotifyRedirectUri?: string;
  /** Debe coincidir carácter a carácter con una Redirect URI en Spotify Dashboard (web). */
  spotifyRedirectUriWeb?: string;
};

function readExtra(): SpotifyExtra {
  return (Constants.expoConfig?.extra ?? {}) as SpotifyExtra;
}

/** Sin barra final — Spotify es estricto con el match. */
function noTrailingSlash(uri: string): string {
  return uri.replace(/\/+$/, '');
}

export function getSpotifyClientId(): string {
  return readExtra().spotifyClientId ?? '';
}

/**
 * OAuth redirect URI (debe coincidir exactamente con Spotify Developer Dashboard).
 *
 * - **Web:** usa `extra.spotifyRedirectUriWeb` (p. ej. `http://localhost:8081/spotify-callback`).
 *   Registrá esa misma URL en el dashboard. Si cambiás de puerto, actualizá app.json y Spotify.
 *   Si no hay `spotifyRedirectUriWeb`, se usa `window.location.origin + /spotify-callback`.
 * - **Native (Expo Go):** `extra.spotifyRedirectUri` (exp://… del túnel actual).
 * - **Dev build:** sin extra, `encorely://spotify-callback` (registralo en Spotify si aplica).
 */
export function getSpotifyRedirectUri(): string {
  const extra = readExtra();

  if (Platform.OS === 'web') {
    const fixed = extra.spotifyRedirectUriWeb?.trim();
    if (fixed) {
      return noTrailingSlash(fixed);
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${noTrailingSlash(window.location.origin)}/spotify-callback`;
    }
    return noTrailingSlash(
      AuthSession.makeRedirectUri({ path: 'spotify-callback' })
    );
  }

  if (extra.spotifyRedirectUri?.trim()) {
    return noTrailingSlash(extra.spotifyRedirectUri.trim());
  }

  return noTrailingSlash(
    AuthSession.makeRedirectUri({
      scheme: 'encorely',
      path: 'spotify-callback',
    })
  );
}
