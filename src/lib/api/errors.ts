export type ProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string
  code?: string
  errors?: Record<string, string[]>
}

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'config' | 'sessionExpired'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  readonly code?: string
  readonly fieldErrors: Record<string, string[]>

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; code?: string; fieldErrors?: Record<string, string[]> } = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts.status ?? 0
    this.code = opts.code
    this.fieldErrors = opts.fieldErrors ?? {}
  }

  static fromProblem(status: number, problem: ProblemDetails | null): ApiError {
    const fieldErrors = normalizeFieldErrors(problem?.errors)
    const message = problem?.detail || problem?.title || fallbackMessage(status)
    return new ApiError('http', message, { status, code: problem?.code, fieldErrors })
  }

  // Primer error de un campo, con la clave en camelCase como la usa el formulario.
  field(name: string): string | null {
    return this.fieldErrors[name]?.[0] ?? null
  }
}

// .NET suele devolver las claves en PascalCase ("Email") o con ruta ("$.email"): las llevamos a camelCase.
function normalizeFieldErrors(errors?: Record<string, string[]>): Record<string, string[]> {
  if (!errors) return {}
  const out: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(errors)) {
    const clean = key.replace(/^\$\./, '')
    const camel = clean.charAt(0).toLowerCase() + clean.slice(1)
    out[camel] = value
  }
  return out
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Tu sesión se cerró. Vuelve a entrar para seguir.'
  if (status === 403) return 'No tienes permiso para hacer esto.'
  if (status === 404) return 'No encontramos lo que buscabas.'
  if (status === 409) return 'Esto cambió mientras tanto. Vuelve a intentarlo.'
  if (status === 429) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
  if (status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en un rato.'
  return 'No pudimos completar la acción.'
}

// Mensaje para mostrar al usuario: nunca códigos HTTP crudos.
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return 'Sin conexión con el servidor. Revisa tu internet e intenta otra vez.'
    if (error.kind === 'timeout') return 'El servidor tardó demasiado en responder. Intenta otra vez.'
    if (error.kind === 'config') return 'La app no tiene configurada la dirección del servidor.'
    return error.message
  }
  return 'Algo salió mal. Intenta otra vez.'
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}
