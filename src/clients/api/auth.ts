// Endpoints de autenticación del backend (api/v1/Auth/*).
import { apiRequest } from './http';
import type { TokenResponse } from './types';

/** POST /Auth/spotify — intercambia el access token de Spotify por identidad de backend. */
export function authWithSpotify(spotifyAccessToken: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/Auth/spotify', {
    method: 'POST',
    body: { token: spotifyAccessToken },
  });
}

/** POST /Auth/google */
export function authWithGoogle(googleIdToken: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/Auth/google', {
    method: 'POST',
    body: { token: googleIdToken },
  });
}

/** POST /Auth/register */
export function registerWithEmail(email: string, password: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/Auth/register', {
    method: 'POST',
    body: { email, password },
  });
}

/** POST /Auth/login */
export function loginWithEmail(email: string, password: string): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/Auth/login', {
    method: 'POST',
    body: { email, password },
  });
}
