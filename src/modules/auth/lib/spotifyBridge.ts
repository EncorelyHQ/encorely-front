/** Evita dependencia circular entre SpotifyAuthProvider y EncorelyAuthProvider. */
let onSpotifyTokenReady: ((spotifyAccessToken: string) => Promise<void>) | null = null;

export function registerSpotifyTokenHandler(
  handler: (spotifyAccessToken: string) => Promise<void>
) {
  onSpotifyTokenReady = handler;
}

export function unregisterSpotifyTokenHandler() {
  onSpotifyTokenReady = null;
}

export async function notifySpotifyTokenReady(spotifyAccessToken: string) {
  if (onSpotifyTokenReady) {
    await onSpotifyTokenReady(spotifyAccessToken);
  }
}
