import { api } from '@/clients/http/client';
import type { UpdateUserSettingsBody, UserProfile } from '@/clients/encorely/types';

export function getUserMe(userId: string) {
  return api<UserProfile>('/user/me', {
    method: 'GET',
    userId,
  });
}

export function updateUserSettings(body: UpdateUserSettingsBody) {
  return api<void>('/user/settings', {
    method: 'PUT',
    body,
  });
}
