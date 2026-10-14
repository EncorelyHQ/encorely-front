import { PermissionStatus } from 'expo'
import * as Notifications from 'expo-notifications'
import { pushAvailability } from './config'
import { ensureMessagesChannel } from './setup'

// 'blocked' = the OS will not show the prompt again; only the system settings can turn it on.
export type PushPermission = 'granted' | 'undetermined' | 'denied' | 'blocked' | 'unavailable'

function toPermission(settings: Notifications.NotificationPermissionsStatus): PushPermission {
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted'
  if (settings.status === PermissionStatus.UNDETERMINED) return 'undetermined'
  return settings.canAskAgain ? 'denied' : 'blocked'
}

// Reads the current state without ever showing a prompt.
export async function getPushPermission(): Promise<PushPermission> {
  if (pushAvailability() !== 'ready') return 'unavailable'
  return toPermission(await Notifications.getPermissionsAsync())
}

// Call only from a moment with context (first match, first time in Chats): never on app start.
export async function requestPushPermission(): Promise<PushPermission> {
  if (pushAvailability() !== 'ready') return 'unavailable'
  const current = toPermission(await Notifications.getPermissionsAsync())
  if (current === 'granted' || current === 'blocked') return current
  await ensureMessagesChannel()
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  })
  return toPermission(result)
}
