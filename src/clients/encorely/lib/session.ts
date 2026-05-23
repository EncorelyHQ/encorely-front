import {
  secureGetItem,
  secureSetItem,
  secureDeleteItems,
} from '@/shared/lib/secureStorage';

export const ENCORELY_SESSION_KEYS = {
  userId: 'encorely_user_id',
  accessToken: 'encorely_access_token',
  refreshToken: 'encorely_refresh_token',
  expiration: 'encorely_token_expiration',
} as const;

export type EncorelySession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiration?: string;
};

export async function getEncorelyAccessToken(): Promise<string | null> {
  return secureGetItem(ENCORELY_SESSION_KEYS.accessToken);
}

export async function getEncorelyUserId(): Promise<string | null> {
  return secureGetItem(ENCORELY_SESSION_KEYS.userId);
}

export async function saveEncorelySession(session: EncorelySession): Promise<void> {
  await Promise.all([
    secureSetItem(ENCORELY_SESSION_KEYS.userId, session.userId),
    secureSetItem(ENCORELY_SESSION_KEYS.accessToken, session.accessToken),
    secureSetItem(ENCORELY_SESSION_KEYS.refreshToken, session.refreshToken),
    session.expiration
      ? secureSetItem(ENCORELY_SESSION_KEYS.expiration, session.expiration)
      : Promise.resolve(),
  ]);
}

export async function clearEncorelySession(): Promise<void> {
  await secureDeleteItems(Object.values(ENCORELY_SESSION_KEYS));
}
