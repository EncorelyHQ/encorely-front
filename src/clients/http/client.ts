import { getApiUrl } from '@/config/api';
import { getEncorelyAccessToken } from '@/clients/encorely/lib/session';
import { ApiError } from './errors';

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  /** Añade ?userId= al query string. */
  userId?: string;
  /** Cuerpo JSON (se serializa automáticamente). */
  body?: unknown;
  /** Si true, envía body como string JSON crudo (chat/venue). */
  rawJsonStringBody?: boolean;
};

function buildUrl(path: string, userId?: string): string {
  const url = new URL(getApiUrl(path));
  if (userId) {
    url.searchParams.set('userId', userId);
  }
  return url.toString();
}

async function parseErrorBody(res: Response): Promise<{ message?: string }> {
  try {
    return (await res.json()) as { message?: string };
  } catch {
    return {};
  }
}

/**
 * Cliente HTTP genérico para Encorely API.
 * Incluye Authorization Bearer cuando hay token en secure storage.
 */
export async function api<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { userId, body, rawJsonStringBody, headers: initHeaders, ...init } = options;

  const token = await getEncorelyAccessToken();
  const headers: Record<string, string> = {
    ...(initHeaders as Record<string, string>),
  };

  if (body !== undefined || rawJsonStringBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: string | undefined;
  if (rawJsonStringBody && typeof body === 'string') {
    requestBody = JSON.stringify(body);
  } else if (body !== undefined) {
    requestBody = JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path, userId), {
    ...init,
    headers,
    body: requestBody,
  });

  if (!res.ok) {
    const errBody = await parseErrorBody(res);
    throw new ApiError(
      res.status,
      errBody.message ?? res.statusText ?? 'Request failed',
      errBody
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
