// Cliente HTTP del backend Encorely (.NET). Wrapper fino sobre fetch con
// manejo de errores, query params y serialización JSON. Mismo estilo que el
// cliente de Spotify (fetch directo, errores con `status` adjunto).

import { getApiBaseUrl, API_PREFIX } from '@/config/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Se serializa a JSON. Para endpoints `[FromBody] string` pasar un string. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Token JWT opcional (el backend no lo exige, pero se envía si está). */
  token?: string | null;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${base}${API_PREFIX}${normalizedPath}`;

  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, token, signal } = options;
  const url = buildUrl(path, query);

  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method, headers, body: payload, signal });

  // 204 No Content (p. ej. PUT /User/settings)
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in (data as any)
        ? (data as any).message
        : null) ?? `API ${res.status}: ${text || res.statusText}`;
    throw new ApiError(res.status, String(message), data);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
