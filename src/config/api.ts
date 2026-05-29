import Constants from 'expo-constants';

type ApiExtra = {
  /** Override fijo de la URL del backend (app.json -> extra.apiBaseUrl). */
  apiBaseUrl?: string;
};

/**
 * URL base del backend Encorely (.NET).
 *
 * Prioridad:
 * 1. `EXPO_PUBLIC_API_URL` (variable de entorno, ideal para CI/Vercel).
 * 2. `extra.apiBaseUrl` en app.json.
 * 3. Default: localhost en dev (Expo web / emulador), Render en producción.
 *
 * Nota: en un dispositivo físico `localhost` apunta al teléfono, no a tu PC.
 * Para probar en dispositivo, define `EXPO_PUBLIC_API_URL=http://<IP-LAN>:5000`.
 */
const DEV_DEFAULT = 'http://localhost:5000';
const PROD_DEFAULT = 'https://encorly-back.onrender.com';

function noTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return noTrailingSlash(fromEnv);

  const extra = (Constants.expoConfig?.extra ?? {}) as ApiExtra;
  if (extra.apiBaseUrl?.trim()) return noTrailingSlash(extra.apiBaseUrl.trim());

  return noTrailingSlash(__DEV__ ? DEV_DEFAULT : PROD_DEFAULT);
}

/** Prefijo común de todos los endpoints REST del backend. */
export const API_PREFIX = '/api/v1';
