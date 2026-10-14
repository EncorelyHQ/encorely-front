import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { registerSignOutTask, useUser } from '@/lib/session/SessionContext'
import { useChatDeps } from '../data/ChatDepsContext'
import { scheduleKeyMaintenance } from '../data/keyMaintenance'
import { forgetPublishedKeys } from '../data/publishKeys'
import { clearChatSessions } from '../data/session'
import { buildHubConnection, createChatRealtime } from './chatHub'

// Sin UI. Se monta una vez dentro del árbol autenticado: publica (y rota cada 7 días) las llaves de este teléfono,
// mantiene el hub abierto mientras la app está al frente y limpia lo del chat al cerrar sesión.
export function ChatBootstrap() {
  const { id: me } = useUser()
  const deps = useChatDeps()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Si falla (sin red), se reintenta cada vez que la app vuelve al frente; enviar también publica si hace falta.
    const maintain = () => {
      scheduleKeyMaintenance(deps, me).catch(() => undefined)
    }
    maintain()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') maintain()
    })
    return () => {
      sub.remove()
      // Al salir del árbol autenticado se cierra la base; el archivo y su llave se quedan para la próxima sesión.
      void deps.local?.closeAll()
    }
  }, [deps, me])

  useEffect(() => {
    const realtime = createChatRealtime({ connection: buildHubConnection(), queryClient })
    if (AppState.currentState === 'active') void realtime.start()
    const sub = AppState.addEventListener('change', (state) => {
      // iOS mata el socket en segundo plano de todos modos; al volver se reconecta y se resincroniza por REST.
      if (state === 'active') void realtime.start()
      else if (state === 'background') void realtime.stop()
    })
    return () => {
      sub.remove()
      realtime.dispose()
      void realtime.stop()
    }
  }, [queryClient, me])

  useEffect(
    () =>
      registerSignOutTask(async (userId, reason) => {
        clearChatSessions()
        forgetPublishedKeys()
        // Al cerrar sesión las llaves y el historial se quedan: al volver a entrar en este teléfono se leen.
        // Al borrar la cuenta no queda nada que leer, y una llave privada huérfana solo es riesgo.
        if (reason === 'delete') {
          await Promise.allSettled([
            deps.deviceKeys.wipeDeviceKeys(userId),
            deps.peerKeys.wipeAll(userId),
            deps.local?.wipe(userId),
          ])
        }
      }),
    [deps],
  )

  return null
}
