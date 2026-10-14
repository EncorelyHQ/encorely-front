import * as SecureStore from 'expo-secure-store'
import { registerSignOutTask } from '@/lib/session/SessionContext'

// THIS_DEVICE_ONLY: ni el verificador PKCE ni el refresh token deben viajar en backups del teléfono.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

// Pasado este tiempo el code de Spotify ya venció: no tiene sentido reanudar.
export const PENDING_TTL_MS = 10 * 60_000

export type PendingAuthorization = {
  verifier: string
  state: string
  redirectUri: string
  createdAt: number
}

// SecureStore solo acepta [A-Za-z0-9._-] en las llaves; se namespacea por usuario para no cruzar cuentas.
function storeKey(userId: string, name: 'pkce' | 'refresh'): string {
  return `spotify_v1_${userId.replace(/[^A-Za-z0-9._-]/g, '_')}_${name}`
}

export async function savePending(userId: string, pending: PendingAuthorization): Promise<void> {
  await SecureStore.setItemAsync(storeKey(userId, 'pkce'), JSON.stringify(pending), OPTIONS)
}

export async function loadPending(userId: string): Promise<PendingAuthorization | null> {
  const raw = await SecureStore.getItemAsync(storeKey(userId, 'pkce'), OPTIONS).catch(() => null)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PendingAuthorization>
    if (
      typeof value.verifier === 'string' &&
      typeof value.state === 'string' &&
      typeof value.redirectUri === 'string' &&
      typeof value.createdAt === 'number'
    ) {
      return value as PendingAuthorization
    }
  } catch {
    // Valor corrupto (p. ej. restaurado de otro dispositivo): se descarta abajo.
  }
  await clearPending(userId)
  return null
}

export async function clearPending(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storeKey(userId, 'pkce'), OPTIONS).catch(() => undefined)
}

export async function saveRefreshToken(userId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(storeKey(userId, 'refresh'), token, OPTIONS)
}

export async function loadRefreshToken(userId: string): Promise<string | null> {
  return SecureStore.getItemAsync(storeKey(userId, 'refresh'), OPTIONS).catch(() => null)
}

export async function clearRefreshToken(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storeKey(userId, 'refresh'), OPTIONS).catch(() => undefined)
}

export async function clearSpotifyData(userId: string): Promise<void> {
  await Promise.all([clearPending(userId), clearRefreshToken(userId)])
}

let cleanupRegistered = false

// Al cerrar sesión o borrar la cuenta no debe quedar ningún acceso a Spotify en el teléfono.
export function ensureSpotifyCleanup(): void {
  if (cleanupRegistered) return
  cleanupRegistered = true
  registerSignOutTask((userId) => clearSpotifyData(userId))
}
