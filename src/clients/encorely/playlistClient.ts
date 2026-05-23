import { getApiUrl } from '@/config/api';
import { getEncorelyAccessToken } from '@/clients/encorely/lib/session';
import { ApiError } from '@/clients/http/errors';
import type { DnaMixQuery, DnaMixResponse } from '@/clients/encorely/types';

/** POST con cuatro query params requeridos (no caben en api() userId único). */
export async function createDnaMix(query: DnaMixQuery): Promise<DnaMixResponse> {
  const url = new URL(getApiUrl('/playlist/dna-mix'));
  url.searchParams.set('userId1', query.userId1);
  url.searchParams.set('userId2', query.userId2);
  url.searchParams.set('accessToken1', query.accessToken1);
  url.searchParams.set('accessToken2', query.accessToken2);

  const token = await getEncorelyAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString(), { method: 'POST', headers });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (errBody as { message?: string }).message ?? res.statusText,
      errBody
    );
  }
  return res.json() as Promise<DnaMixResponse>;
}
