import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useSession } from '@/lib/session/SessionContext'
import { pushAvailability, reportPushError } from './config'
import { routeForPush } from './payload'

// Module scope so a remount (or the cold-start response showing up again in the listener) never
// navigates twice for the same tap.
const handled = new Set<string>()
let coldStartChecked = false
// The launch response is read asynchronously: by the time it resolves the session may have ended.
let listening = false

export function usePushNavigation(): void {
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'signedIn' || pushAvailability() !== 'ready') return
    listening = true

    const open = (response: Notifications.NotificationResponse) => {
      if (!listening || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
      const { identifier, content } = response.notification.request
      if (handled.has(identifier)) return
      const route = routeForPush(content.data)
      if (!route) return
      handled.add(identifier)
      router.push(route)
    }

    if (!coldStartChecked) {
      coldStartChecked = true
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) open(response)
        })
        .catch((error: unknown) => reportPushError('read launch notification', error))
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(open)
    return () => {
      listening = false
      subscription.remove()
    }
  }, [status])
}

export function resetPushNavigationForTests(): void {
  handled.clear()
  coldStartChecked = false
  listening = false
}
