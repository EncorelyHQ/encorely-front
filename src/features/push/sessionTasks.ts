import { registerSignInTask, registerSignOutTask } from '@/lib/session/SessionContext'
import { pushAvailability } from './config'
import { setPushUser, syncPushToken, unregisterPushToken } from './registration'

let installed = false

// Registered at module load, not on mount: sign-in fires its tasks before the authenticated tree
// (and PushBootstrap) exists, so a mount-time registration would miss it.
export function installPushSessionTasks(): void {
  if (installed) return
  installed = true
  registerSignInTask(async (userId) => {
    if (pushAvailability() !== 'ready') return
    setPushUser(userId)
    await syncPushToken()
  })
  registerSignOutTask(async (userId, reason) => {
    if (pushAvailability() !== 'ready') return
    await unregisterPushToken(userId, reason)
  })
}
