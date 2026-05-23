import {
  loginWithEmail,
  loginWithGoogle,
  loginWithSpotify,
  registerWithEmail,
} from '@/clients/encorely/authClient';
import {
  clearEncorelySession,
  saveEncorelySession,
} from '@/clients/encorely/lib/session';
import type { EmailPasswordBody, TokenResponse } from '@/clients/encorely/types';

async function persistTokenResponse(session: TokenResponse) {
  await saveEncorelySession({
    userId: session.userId,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiration: session.expiration,
  });
  return session;
}

export const authService = {
  loginWithSpotify: async (spotifyAccessToken: string) =>
    persistTokenResponse(await loginWithSpotify(spotifyAccessToken)),

  loginWithGoogle: async (googleToken: string) =>
    persistTokenResponse(await loginWithGoogle(googleToken)),

  registerWithEmail: async (body: EmailPasswordBody) =>
    persistTokenResponse(await registerWithEmail(body)),

  loginWithEmail: async (body: EmailPasswordBody) =>
    persistTokenResponse(await loginWithEmail(body)),

  logout: () => clearEncorelySession(),
};
