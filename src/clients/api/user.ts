// Endpoints de usuario (api/v1/User/*).
import { apiRequest } from './http';
import { ConcertMood, type BackendUser } from './types';

/** GET /User/me?userId={guid} */
export function getMe(userId: string): Promise<BackendUser> {
  return apiRequest<BackendUser>('/User/me', { query: { userId } });
}

/** PUT /User/settings — actualiza el mood (enviado como int). Devuelve 204. */
export function updateSettings(userId: string, mood: ConcertMood): Promise<void> {
  return apiRequest<void>('/User/settings', {
    method: 'PUT',
    body: { userId, mood },
  });
}
