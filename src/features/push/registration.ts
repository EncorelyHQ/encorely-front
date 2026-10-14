import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { devicesApi } from '@/lib/api/endpoints'
import { getSession } from '@/lib/session/tokenStore'
import { pushAvailability, pushPlatform, reportPushError, resolveProjectId } from './config'
import { getPushPermission } from './permission'
import { ensureMessagesChannel } from './setup'

// The last token the backend accepted, so sign-out can remove exactly that one (even after a restart).
const STORE_KEY = 'encorely_push_token_v1'
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}
const UNREGISTER_TIMEOUT_MS = 3000

type Registered = { token: string; userId: string }
export type SyncResult = 'registered' | 'unchanged' | 'skipped' | 'failed'

let activeUserId: string | null = null
let expoToken: string | null = null
// "userId:token" already PUT in this process: the PUT is idempotent but there is no reason to repeat it.
let sentKey: string | null = null
let inflight: Promise<SyncResult> | null = null
let inflightUserId: string | null = null

export function setPushUser(userId: string | null): void {
  if (userId === activeUserId) return
  activeUserId = userId
  sentKey = null
}

async function readRegistered(): Promise<Registered | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY, STORE_OPTIONS)
    return raw ? (JSON.parse(raw) as Registered) : null
  } catch (error) {
    reportPushError('read stored token', error)
    return null
  }
}

async function writeRegistered(value: Registered | null): Promise<void> {
  try {
    if (value) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(value), STORE_OPTIONS)
    else await SecureStore.deleteItemAsync(STORE_KEY, STORE_OPTIONS)
  } catch (error) {
    reportPushError('store token', error)
  }
}

type SyncOptions = {
  // From addPushTokenListener: passing it avoids getDevicePushTokenAsync re-emitting the event in a loop.
  devicePushToken?: Notifications.DevicePushToken
}

// Safe to call often (app start, sign-in, back to foreground, token rotation): it never prompts and
// only talks to the backend when the user/token pair changed.
export function syncPushToken(options: SyncOptions = {}): Promise<SyncResult> {
  if (inflight) {
    // A rotated token or a different user cannot reuse the running sync: queue a fresh one after it.
    const stale = !!options.devicePushToken || inflightUserId !== activeUserId
    return stale ? inflight.then(() => syncPushToken(options)) : inflight
  }
  if (options.devicePushToken) expoToken = null
  inflightUserId = activeUserId
  inflight = runSync(options).finally(() => {
    inflight = null
  })
  return inflight
}

async function runSync({ devicePushToken }: SyncOptions): Promise<SyncResult> {
  const userId = activeUserId
  const projectId = resolveProjectId()
  if (!userId || !projectId || pushAvailability() !== 'ready') return 'skipped'
  try {
    if ((await getPushPermission()) !== 'granted') return 'skipped'
    await ensureMessagesChannel()
    if (!expoToken) {
      const result = await Notifications.getExpoPushTokenAsync({ projectId, devicePushToken })
      expoToken = result.data
    }
    const token = expoToken
    if (sentKey === `${userId}:${token}`) return 'unchanged'

    await devicesApi.registerPush(token, pushPlatform())
    // The user may have signed out while the request was in flight.
    if (activeUserId !== userId) return 'skipped'
    sentKey = `${userId}:${token}`

    const previous = await readRegistered()
    await writeRegistered({ token, userId })
    if (previous && previous.userId === userId && previous.token !== token) {
      // A rotated token is dead anyway; removing it just keeps the backend list clean.
      devicesApi.unregisterPush(previous.token).catch((error: unknown) => reportPushError('remove rotated token', error))
    }
    return 'registered'
  } catch (error) {
    reportPushError('register', error)
    return 'failed'
  }
}

function accessTokenUsable(): boolean {
  const session = getSession()
  return !!session && session.accessExpiresAt > Date.now()
}

// Best effort and time-boxed: signing out must never wait on the network.
export async function unregisterPushToken(userId: string, reason: 'signOut' | 'delete'): Promise<void> {
  const registered = await readRegistered()
  setPushUser(null)
  expoToken = null
  await writeRegistered(null)
  Notifications.dismissAllNotificationsAsync().catch((error: unknown) => reportPushError('dismiss', error))

  // Deleting the account already removes its devices server side, and a DELETE with a revoked user
  // would 401 and fire the "session expired" notice. Same with an expired access token: the refresh
  // token was just revoked by logout, so the refresh would fail the same way.
  if (!registered || registered.userId !== userId || reason === 'delete' || !accessTokenUsable()) return

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS)
  })
  const request = devicesApi
    .unregisterPush(registered.token)
    .catch((error: unknown) => reportPushError('unregister', error))
  try {
    await Promise.race([request, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export function resetRegistrationForTests(): void {
  activeUserId = null
  expoToken = null
  sentKey = null
  inflight = null
  inflightUserId = null
}
