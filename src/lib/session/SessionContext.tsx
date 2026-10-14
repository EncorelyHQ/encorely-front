import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onSessionExpired } from '@/lib/api/client'
import { authApi, meApi } from '@/lib/api/endpoints'
import type { LoginRequest, Me, RegisterRequest, SessionUser } from '@/lib/api/types'
import { queryClient, queryKeys } from '@/lib/query'
import { clearSession, getSession, loadSession, saveSession } from './tokenStore'

type Status = 'loading' | 'signedOut' | 'signedIn' | 'bootError'

type SessionValue = {
  status: Status
  user: SessionUser | null
  // Motivo del último cierre forzado ("tu sesión se cerró"), para mostrarlo en el login.
  notice: string | null
  bootError: unknown
  signIn: (body: LoginRequest) => Promise<void>
  signUp: (body: RegisterRequest) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  applyMe: (me: Me) => void
  retryBoot: () => void
  clearNotice: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

type Task = (userId: string, reason: 'signOut' | 'delete') => Promise<void> | void
const signOutTasks = new Set<Task>()

// Módulos como push o el chat limpian lo suyo al cerrar sesión sin que la sesión los conozca.
export function registerSignOutTask(task: Task): () => void {
  signOutTasks.add(task)
  return () => signOutTasks.delete(task)
}

type SignInTask = (userId: string) => Promise<void> | void
const signInTasks = new Set<SignInTask>()

export function registerSignInTask(task: SignInTask): () => void {
  signInTasks.add(task)
  return () => signInTasks.delete(task)
}

function toSessionUser(me: Me): SessionUser {
  return {
    id: me.id,
    email: me.email,
    displayName: me.displayName,
    onboardingCompleted: me.onboardingCompleted,
    role: me.role,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [bootError, setBootError] = useState<unknown>(null)
  const [bootAttempt, setBootAttempt] = useState(0)

  const runSignInTasks = useCallback((userId: string) => {
    signInTasks.forEach((task) => {
      Promise.resolve(task(userId)).catch(() => undefined)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = await loadSession()
      if (!stored) {
        if (!cancelled) setStatus('signedOut')
        return
      }
      try {
        const me = await meApi.get()
        if (cancelled) return
        queryClient.setQueryData(queryKeys.me, me)
        setUser(toSessionUser(me))
        setStatus('signedIn')
        runSignInTasks(me.id)
      } catch (error) {
        if (cancelled) return
        if (!getSession()) {
          setStatus('signedOut')
          return
        }
        setBootError(error)
        setStatus('bootError')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bootAttempt, runSignInTasks])

  const finish = useCallback(
    async (reason: 'delete' | 'local') => {
      const userId = getSession()?.userId ?? user?.id
      if (userId && reason === 'delete') {
        await Promise.allSettled([...signOutTasks].map((task) => task(userId, reason)))
      }
      await clearSession()
      queryClient.clear()
      setUser(null)
      setStatus('signedOut')
    },
    [user?.id],
  )

  useEffect(
    () =>
      onSessionExpired((reason) => {
        setNotice(
          reason === 'banned'
            ? 'Tu cuenta está suspendida. Si crees que es un error, escríbenos.'
            : 'Tu sesión se cerró. Vuelve a entrar para seguir.',
        )
        void finish('local')
      }),
    [finish],
  )

  const signIn = useCallback(
    async (body: LoginRequest) => {
      const auth = await authApi.login(body)
      await saveSession(auth)
      queryClient.clear()
      setNotice(null)
      setUser(auth.user)
      setStatus('signedIn')
      runSignInTasks(auth.user.id)
    },
    [runSignInTasks],
  )

  const signUp = useCallback(
    async (body: RegisterRequest) => {
      const auth = await authApi.register(body)
      await saveSession(auth)
      queryClient.clear()
      setNotice(null)
      setUser(auth.user)
      setStatus('signedIn')
      runSignInTasks(auth.user.id)
    },
    [runSignInTasks],
  )

  const signOut = useCallback(async () => {
    const session = getSession()
    // Las tareas (p. ej. borrar el token de push) necesitan la sesión viva: corren antes de revocar el refresh.
    if (session) await Promise.allSettled([...signOutTasks].map((task) => task(session.userId, 'signOut')))
    // Cerrar sesión en el dispositivo nunca depende de que el servidor responda.
    if (session) await authApi.logout(session.refreshToken).catch(() => undefined)
    await finish('local')
  }, [finish])

  const deleteAccount = useCallback(async () => {
    await meApi.remove()
    await finish('delete')
  }, [finish])

  const applyMe = useCallback((me: Me) => {
    queryClient.setQueryData(queryKeys.me, me)
    setUser(toSessionUser(me))
  }, [])

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      notice,
      bootError,
      signIn,
      signUp,
      signOut,
      deleteAccount,
      applyMe,
      retryBoot: () => {
        setStatus('loading')
        setBootAttempt((n) => n + 1)
      },
      clearNotice: () => setNotice(null),
    }),
    [status, user, notice, bootError, signIn, signUp, signOut, deleteAccount, applyMe],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}

// Para pantallas dentro de (app): ahí el usuario siempre existe.
export function useUser(): SessionUser {
  const { user } = useSession()
  if (!user) throw new Error('useUser called without an authenticated session')
  return user
}
