import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { MESSAGES_CHANNEL_ID } from './config'
import { parsePushData } from './payload'

let channelReady: Promise<void> | null = null

// Android 13+ will not hand out a push token until a channel exists, so this runs before any token request.
export function ensureMessagesChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve()
  if (!channelReady) {
    channelReady = Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
      name: 'Mensajes',
      description: 'Avisos de mensajes y matches nuevos. Nunca incluyen el contenido.',
      importance: Notifications.AndroidImportance.HIGH,
      // One short pulse: HIGH keeps the heads-up banner, the default pattern buzzes three times.
      enableVibrate: true,
      vibrationPattern: [0, 180],
      showBadge: true,
    })
      .then(() => undefined)
      .catch((error: unknown) => {
        channelReady = null
        throw error
      })
  }
  return channelReady
}

const SILENT: Notifications.NotificationBehavior = {
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
}

// Foreground policy: the ChatHub already updates the chats list live, so a chat banner (or a stale tray
// entry) would only duplicate it. A new match is not shown anywhere else, so it stays in the list without
// sound (on Android no sound also means no heads-up, which is the quiet behavior we want in-app).
export function foregroundBehavior(notification: Notifications.Notification): Notifications.NotificationBehavior {
  const payload = parsePushData(notification.request.content.data)
  if (payload?.t === 'match') {
    return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }
  }
  if (payload?.t === 'chat') return { ...SILENT, shouldSetBadge: true }
  return SILENT
}

let handlerInstalled = false

export function installNotificationHandler(): void {
  if (handlerInstalled) return
  handlerInstalled = true
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => foregroundBehavior(notification),
  })
}

export function resetSetupForTests(): void {
  channelReady = null
  handlerInstalled = false
}
