import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import { getSpotifyClientId, getSpotifyRedirectUri, SPOTIFY_ACCOUNTS_URL, SPOTIFY_SCOPES } from './config'
import { SpotifyError, spotifyErrorFromStatus, spotifyTokenError } from './errors'
import { encodeQuery, parseQuery, readJson, spotifyFetch } from './http'
import { clearPending, loadPending, PENDING_TTL_MS, savePending } from './storage'

export type SpotifyTokens = {
  accessToken: string
  // Spotify puede no rotarlo en un refresh; null = conservar el que ya había.
  refreshToken: string | null
  expiresIn: number
}

export type AuthorizationParams = {
  code?: string
  state?: string
  error?: string
}

export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return toBase64Url(btoa(binary))
}

// RFC 7636: verificador de 43 caracteres a partir de 32 bytes aleatorios (rango permitido 43–128).
export async function createVerifier(): Promise<string> {
  return bytesToBase64Url(await Crypto.getRandomBytesAsync(32))
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  return toBase64Url(digest)
}

export async function createState(): Promise<string> {
  return bytesToBase64Url(await Crypto.getRandomBytesAsync(16))
}

export function buildAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  challenge: string
  state: string
}): string {
  const query = encodeQuery({
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    scope: SPOTIFY_SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: input.challenge,
    state: input.state,
  })
  return `${SPOTIFY_ACCOUNTS_URL}/authorize?${query}`
}

export function paramsFromUrl(url: string): AuthorizationParams {
  const { code, state, error } = parseQuery(url)
  return { code, state, error }
}

// El state se valida ANTES de mirar `error` o `code`: una redirección forjada no debe avanzar ni un paso (CSRF).
export function readAuthorizationCode(params: AuthorizationParams, expectedState: string): string {
  if (!expectedState || !params.state || params.state !== expectedState) throw new SpotifyError('state')
  if (params.error) throw new SpotifyError(params.error === 'access_denied' ? 'denied' : 'unknown')
  if (!params.code) throw new SpotifyError('unknown')
  return params.code
}

async function requestToken(body: Record<string, string>): Promise<SpotifyTokens> {
  const response = await spotifyFetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeQuery(body),
  })
  const data = await readJson(response)
  if (!response.ok) {
    throw response.status === 400 || response.status === 401
      ? spotifyTokenError(response.status, data?.error)
      : spotifyErrorFromStatus(response.status)
  }
  if (!data || typeof data.access_token !== 'string') throw new SpotifyError('unknown', response.status)
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
  }
}

export function exchangeCode(input: {
  code: string
  verifier: string
  redirectUri: string
  clientId: string
}): Promise<SpotifyTokens> {
  return requestToken({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.verifier,
  })
}

export function refreshAccessToken(refreshToken: string, clientId = getSpotifyClientId()): Promise<SpotifyTokens> {
  if (!clientId) return Promise.reject(new SpotifyError('config'))
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId })
}

// Mientras openAuthSessionAsync espera, la ruta /spotify-callback también puede recibir el deep link en Android:
// esta bandera evita canjear el mismo code dos veces (el segundo intento fallaría con invalid_grant).
let authorizationInFlight = false

export function isAuthorizationInFlight(): boolean {
  return authorizationInFlight
}

export async function authorizeWithSpotify(userId: string): Promise<SpotifyTokens> {
  const clientId = getSpotifyClientId()
  if (!clientId) throw new SpotifyError('config')
  const redirectUri = getSpotifyRedirectUri()
  const verifier = await createVerifier()
  const [challenge, state] = await Promise.all([challengeFromVerifier(verifier), createState()])

  // Se guarda antes de abrir el navegador: si Android mata la app, la ruta de callback puede reanudar.
  await savePending(userId, { verifier, state, redirectUri, createdAt: Date.now() })
  authorizationInFlight = true
  try {
    const result = await WebBrowser.openAuthSessionAsync(
      buildAuthorizeUrl({ clientId, redirectUri, challenge, state }),
      redirectUri,
      { showInRecents: true },
    )
    if (result.type !== 'success') throw new SpotifyError('cancelled')
    const code = readAuthorizationCode(paramsFromUrl(result.url), state)
    return await exchangeCode({ code, verifier, redirectUri, clientId })
  } finally {
    authorizationInFlight = false
    await clearPending(userId)
  }
}

// Reanuda tras un deep link a encorely://spotify-callback cuando la app murió durante el login.
// null = no hay nada que reanudar (otro flujo lo está atendiendo o el verificador ya se usó).
export async function completeAuthorizationRedirect(
  userId: string,
  params: AuthorizationParams,
): Promise<SpotifyTokens | null> {
  if (authorizationInFlight) return null
  const pending = await loadPending(userId)
  if (!pending) return null
  // Un solo uso: el verificador se borra antes de canjear para que un segundo deep link no lo reutilice.
  await clearPending(userId)
  if (Date.now() - pending.createdAt > PENDING_TTL_MS) throw new SpotifyError('expired')
  const clientId = getSpotifyClientId()
  if (!clientId) throw new SpotifyError('config')
  const code = readAuthorizationCode(params, pending.state)
  return exchangeCode({ code, verifier: pending.verifier, redirectUri: pending.redirectUri, clientId })
}
