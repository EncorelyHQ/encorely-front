import * as SecureStore from 'expo-secure-store'
import type { AuthResponse } from '@/lib/api/types'

// Lo único de la sesión que vive en el dispositivo son los tokens (GEN-25): todo lo demás sale del API.
const KEY = 'encorely_session_v1'
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export type StoredSession = {
  accessToken: string
  refreshToken: string
  // Epoch ms en que vence el access token, con margen aplicado al guardar.
  accessExpiresAt: number
  userId: string
}

let current: StoredSession | null = null
let loaded = false

export async function loadSession(): Promise<StoredSession | null> {
  if (loaded) return current
  try {
    const raw = await SecureStore.getItemAsync(KEY, options)
    current = raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    // Valor ilegible (p. ej. restaurado desde backup en Android): se trata como sesión cerrada.
    current = null
  }
  loaded = true
  return current
}

export function getSession(): StoredSession | null {
  return current
}

export async function saveSession(auth: AuthResponse): Promise<StoredSession> {
  const next: StoredSession = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accessExpiresAt: Date.now() + Math.max(0, auth.expiresIn - 30) * 1000,
    userId: auth.user.id,
  }
  current = next
  loaded = true
  await SecureStore.setItemAsync(KEY, JSON.stringify(next), options)
  return next
}

export async function clearSession(): Promise<void> {
  current = null
  loaded = true
  await SecureStore.deleteItemAsync(KEY, options).catch(() => undefined)
}
