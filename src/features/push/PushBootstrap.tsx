import { useEffect } from 'react'
import { AppState } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useSession } from '@/lib/session/SessionContext'
import { pushAvailability, reportPushError } from './config'
import { setPushUser, syncPushToken } from './registration'
import { installPushSessionTasks } from './sessionTasks'
import { ensureMessagesChannel, installNotificationHandler } from './setup'
import { usePushNavigation } from './usePushNavigation'

installPushSessionTasks()

// No UI. Mount once inside the authenticated tree; it never asks for permission by itself.
export function PushBootstrap(): null {
  const { status, user } = useSession()
  const userId = status === 'signedIn' ? (user?.id ?? null) : null

  usePushNavigation()

  useEffect(() => {
    if (pushAvailability() !== 'ready') return
    installNotificationHandler()
    ensureMessagesChannel().catch((error: unknown) => reportPushError('create channel', error))

    const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
      void syncPushToken({ devicePushToken })
    })
    // Coming back to the app covers a permission granted from system settings and a PUT that failed offline.
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncPushToken()
    })
    return () => {
      tokenSubscription.remove()
      appStateSubscription.remove()
    }
  }, [])

  useEffect(() => {
    if (!userId || pushAvailability() !== 'ready') return
    setPushUser(userId)
    void syncPushToken()
    // An expired session skips the sign-out tasks: forgetting the user here keeps a late sync from
    // registering the token for someone who is no longer signed in.
    return () => setPushUser(null)
  }, [userId])

  return null
}
