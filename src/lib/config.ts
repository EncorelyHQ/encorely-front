// Sin fallback a localhost: en un teléfono "localhost" es el propio teléfono y la app quedaría colgada en silencio.
const raw = process.env.EXPO_PUBLIC_API_URL?.trim() ?? ''

export const API_URL = raw.replace(/\/+$/, '')
export const API_BASE = `${API_URL}/api/v1`
export const HUB_URL = `${API_URL}/hubs/chat`
export const isApiConfigured = API_URL.length > 0

export const REQUEST_TIMEOUT_MS = 15_000
