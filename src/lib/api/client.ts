import { API_BASE, isApiConfigured, REQUEST_TIMEOUT_MS } from '@/lib/config'
import { clearSession, getSession, saveSession } from '@/lib/session/tokenStore'
import { ApiError, type ProblemDetails } from './errors'
import type { AuthResponse } from './types'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  body?: unknown
  query?: Record<string, string | number | undefined | null>
  auth?: boolean
  signal?: AbortSignal
  // Para cargas grandes (respaldo cifrado de hasta 10 MiB) los 15 s por defecto no alcanzan en redes lentas.
  timeoutMs?: number
}

export type ExpiredReason = 'expired' | 'banned'
type ExpiredListener = (reason: ExpiredReason) => void
const expiredListeners = new Set<ExpiredListener>()

// La sesión se entera de que el refresh falló y vuelve al login con un mensaje claro (no app zombi).
export function onSessionExpired(listener: ExpiredListener): () => void {
  expiredListeners.add(listener)
  return () => expiredListeners.delete(listener)
}

let refreshing: Promise<string> | null = null

// Un solo refresh en vuelo: si 5 peticiones reciben 401 a la vez, rotar 5 veces revocaría la familia de tokens.
export function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function doRefresh(): Promise<string> {
  const session = getSession()
  if (!session) throw new ApiError('sessionExpired', 'Tu sesión se cerró. Vuelve a entrar para seguir.', { status: 401 })
  try {
    const auth = await send<AuthResponse>('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken }, auth: false })
    const next = await saveSession(auth)
    return next.accessToken
  } catch (error) {
    // Solo un rechazo explícito del servidor cierra la sesión; sin red se conserva para reintentar luego.
    if (error instanceof ApiError && error.kind === 'http' && (error.status === 400 || error.status === 401)) {
      await clearSession()
      expiredListeners.forEach((l) => l('expired'))
      throw new ApiError('sessionExpired', 'Tu sesión se cerró. Vuelve a entrar para seguir.', { status: 401 })
    }
    throw error
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const session = getSession()
  if (!session) return null
  if (Date.now() < session.accessExpiresAt) return session.accessToken
  return refreshAccessToken()
}

export async function api<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? true
  if (auth) await getValidAccessToken().catch(() => null)
  try {
    return await send<T>(method, path, opts)
  } catch (error) {
    // Una cuenta suspendida no se recupera reintentando: se cierra la sesión con un aviso claro.
    if (auth && error instanceof ApiError && error.code === 'account_banned') {
      await clearSession()
      expiredListeners.forEach((l) => l('banned'))
      throw error
    }
    if (auth && error instanceof ApiError && error.kind === 'http' && error.status === 401) {
      await refreshAccessToken()
      return send<T>(method, path, opts)
    }
    // Un GET es idempotente: un solo reintento ante un corte de red momentáneo.
    if (method === 'GET' && error instanceof ApiError && error.kind === 'network' && !opts.signal?.aborted) {
      return send<T>(method, path, opts)
    }
    throw error
  }
}

async function send<T>(method: Method, path: string, opts: RequestOptions): Promise<T> {
  if (!isApiConfigured) throw new ApiError('config', 'Falta EXPO_PUBLIC_API_URL')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onAbort)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = (opts.auth ?? true) ? getSession()?.accessToken : undefined
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
  } catch {
    if (opts.signal?.aborted) throw new ApiError('network', 'Petición cancelada')
    if (controller.signal.aborted) throw new ApiError('timeout', 'Tiempo de espera agotado')
    throw new ApiError('network', 'Sin conexión')
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data = text ? safeJson(text) : null

  if (!response.ok) throw ApiError.fromProblem(response.status, data as ProblemDetails | null)
  return data as T
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`
  if (!query) return url
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return params.length ? `${url}?${params.join('&')}` : url
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
