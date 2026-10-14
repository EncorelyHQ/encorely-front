import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { registerSignOutTask, useUser } from '@/lib/session/SessionContext'
import { useChatDeps } from '../data/ChatDepsContext'
import { ensureKeysPublished, forgetPublishedKeys } from '../data/publishKeys'
import { clearChatSessions } from '../data/session'
import { buildHubConnection, createChatRealtime } from './chatHub'

// Sin UI. Se monta una vez dentro del árbol autenticado: publica las llaves de este teléfono, mantiene
// el hub abierto mientras la app está al frente y limpia lo del chat al cerrar sesión.
export function ChatBootstrap() {
  const { id: me } = useUser()
  const deps = useChatDeps()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Si falla (sin red), se reintenta cada vez que la app vuelve al frente; enviar también lo reintenta.
    const publish = () => {
      ensureKeysPublished(deps, me).catch(() => undefined)
    }
    publish()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') publish()
    })
    return () => sub.remove()
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
        // Al cerrar sesión las llaves se quedan: al volver a entrar en este teléfono se lee el historial.
        // Al borrar la cuenta no queda nada que leer, y una llave privada huérfana solo es riesgo.
        if (reason === 'delete') await deps.deviceKeys.wipeDeviceKeys(userId)
      }),
    [deps],
  )

  return null
}
