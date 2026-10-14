import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

export type PushAvailability = 'ready' | 'missingProjectId' | 'simulator' | 'unsupported'

export const MESSAGES_CHANNEL_ID = 'messages'

// The Expo push token is scoped to the EAS project: without its id the token cannot be requested.
export function resolveProjectId(): string | null {
  const candidates: unknown[] = [
    Constants.expoConfig?.extra?.eas?.projectId,
    Constants.easConfig?.projectId,
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

// Every entry point of the module checks this first, so a build without EAS/FCM never asks for permission.
export function pushAvailability(): PushAvailability {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'unsupported'
  if (!resolveProjectId()) return 'missingProjectId'
  if (!Device.isDevice) return 'simulator'
  return 'ready'
}

export function pushPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android'
}

// Only the error code/name reaches the console: messages from exp.host or the API could echo the token.
export function reportPushError(scope: string, error: unknown): void {
  if (!__DEV__) return
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.name
        : 'unknown'
  console.warn(`[push] ${scope} failed (${code})`)
}
