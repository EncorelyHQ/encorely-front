import Constants from 'expo-constants';

/** Prefijo de rutas REST del backend Encorely. */
export const API_PREFIX = '/api/v1';

/** Swipes mínimos para Radar y chat (regla de negocio del backend). */
export const API_SWIPE_THRESHOLD = 25;

const DEFAULT_API_BASE_URL = 'http://localhost:5050';

type ApiExtra = {
  apiBaseUrl?: string;
};

function readExtra(): ApiExtra {
  return (Constants.expoConfig?.extra ?? {}) as ApiExtra;
}

/**
 * URL base del backend (sin barra final).
 * Configurar en app.json → extra.apiBaseUrl.
 *
 * CORS: si el front web corre en otro origen, el navegador puede bloquear
 * peticiones hasta que el backend habilite CORS o uses proxy en el bundler.
 */
export function getApiBaseUrl(): string {
  const fromExtra = readExtra().apiBaseUrl?.trim();
  if (fromExtra) {
    return fromExtra.replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

/** URL absoluta: base + /api/v1 + path (path debe empezar con /). */
export function getApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${API_PREFIX}${normalized}`;
}
