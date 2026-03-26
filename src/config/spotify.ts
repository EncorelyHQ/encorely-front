import Constants from 'expo-constants';

export const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export const SPOTIFY_SWIPE_MARKET = 'US';
export const SPOTIFY_FALLBACK_PLAYLIST_ID = '37i9dQZF1DXcBWIGoYBM5M';
export const SPOTIFY_SWIPE_MIN_VALID_TRACKS = 5;

export function getSpotifyClientId(): string {
  return (Constants.expoConfig?.extra?.spotifyClientId as string) ?? '';
}

/** OAuth redirect; prefers app.json extra, falls back to dev tunnel URI */
export function getSpotifyRedirectUri(): string {
  return (
    (Constants.expoConfig?.extra?.spotifyRedirectUri as string) ||
    'exp://3abvrlm-anonymous-8081.exp.direct'
  );
}
