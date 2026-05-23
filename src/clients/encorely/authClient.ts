import { api } from '@/clients/http/client';
import type {
  EmailPasswordBody,
  ProviderTokenBody,
  TokenResponse,
} from '@/clients/encorely/types';

export function loginWithSpotify(spotifyAccessToken: string) {
  return api<TokenResponse>('/auth/spotify', {
    method: 'POST',
    body: { token: spotifyAccessToken } satisfies ProviderTokenBody,
  });
}

export function loginWithGoogle(googleToken: string) {
  return api<TokenResponse>('/auth/google', {
    method: 'POST',
    body: { token: googleToken } satisfies ProviderTokenBody,
  });
}

export function registerWithEmail(body: EmailPasswordBody) {
  return api<TokenResponse>('/auth/register', {
    method: 'POST',
    body,
  });
}

export function loginWithEmail(body: EmailPasswordBody) {
  return api<TokenResponse>('/auth/login', {
    method: 'POST',
    body,
  });
}
