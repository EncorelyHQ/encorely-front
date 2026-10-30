import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import { getSpotifyClientId, getSpotifyRedirectUri, SPOTIFY_ACCOUNTS_URL, SPOTIFY_LOGIN_SCOPES, SPOTIFY_SCOPES } from './config'
import { SpotifyError, spotifyErrorFromStatus, spotifyTokenError } from './errors'
import { encodeQuery, parseQuery, readJson, spotifyFetch } from './http'
import { clearPending, grantPendingKey, loadPending, PENDING_TTL_MS, savePending } from './storage'

export type SpotifyTokens = {
  accessToken: string
  // Spotify puede no rotarlo en un refresh; null = conservar el que ya había.
  refreshToken: string | null
  expiresIn: number
}

// Lo que el back necesita para canjear el code él mismo: así el token es de nuestro client id.
export type SpotifyGrant = {
  code: string
  codeVerifier: string
  redirectUri: string
}

export type SpotifyLoginGrant = SpotifyGrant & { consentVersion: string | null }

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
  scopes?: readonly string[]
}): string {
  const query = encodeQuery({
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    scope: (input.scopes ?? SPOTIFY_SCOPES).join(' '),
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

// Antes de abrir el navegador no hay sesión de Encorely en el login: el PKCE pendiente se guarda bajo esta llave.
export const LOGIN_PENDING_KEY = 'login'

type Authorization = { code: string; verifier: string; redirectUri: string; clientId: string }

async function requestAuthorization(
  pendingKey: string,
  scopes: readonly string[],
  consentVersion?: string | null,
): Promise<Authorization> {
  const clientId = getSpotifyClientId()
  if (!clientId) throw new SpotifyError('config')
  const redirectUri = getSpotifyRedirectUri()
  const verifier = await createVerifier()
  const [challenge, state] = await Promise.all([challengeFromVerifier(verifier), createState()])

  // Se guarda antes de abrir el navegador: si Android mata la app, la ruta de callback puede reanudar.
  await savePending(pendingKey, { verifier, state, redirectUri, createdAt: Date.now(), consentVersion })
  authorizationInFlight = true
  try {
    const result = await WebBrowser.openAuthSessionAsync(
      buildAuthorizeUrl({ clientId, redirectUri, challenge, state, scopes }),
      redirectUri,
      { showInRecents: true },
    )
    if (result.type !== 'success') throw new SpotifyError('cancelled')
    return { code: readAuthorizationCode(paramsFromUrl(result.url), state), verifier, redirectUri, clientId }
  } finally {
    authorizationInFlight = false
    await clearPending(pendingKey)
  }
}

export async function authorizeWithSpotify(userId: string): Promise<SpotifyTokens> {
  const { code, verifier, redirectUri, clientId } = await requestAuthorization(userId, SPOTIFY_SCOPES)
  return exchangeCode({ code, verifier, redirectUri, clientId })
}

// Vincular Spotify o reconfirmar el borrado: mismo grant que el login, pero con sesión y sin términos.
export async function authorizeSpotifyGrant(userId: string): Promise<SpotifyGrant> {
  const { code, verifier, redirectUri } = await requestAuthorization(grantPendingKey(userId), SPOTIFY_LOGIN_SCOPES)
  return { code, codeVerifier: verifier, redirectUri }
}

// El code no se canjea aquí: viaja al back con su verificador y el back lo canjea contra Spotify.
export async function authorizeSpotifyLogin(consentVersion: string | null): Promise<SpotifyLoginGrant> {
  const { code, verifier, redirectUri } = await requestAuthorization(LOGIN_PENDING_KEY, SPOTIFY_LOGIN_SCOPES, consentVersion)
  return { code, codeVerifier: verifier, redirectUri, consentVersion }
}

async function takePending(pendingKey: string, params: AuthorizationParams) {
  if (authorizationInFlight) return null
  const pending = await loadPending(pendingKey)
  if (!pending) return null
  // Un solo uso: el verificador se borra antes de canjear para que un segundo deep link no lo reutilice.
  await clearPending(pendingKey)
  if (Date.now() - pending.createdAt > PENDING_TTL_MS) throw new SpotifyError('expired')
  return { pending, code: readAuthorizationCode(params, pending.state) }
}

// Reanuda tras un deep link a encorely://spotify-callback cuando la app murió durante la conexión.
// null = no hay nada que reanudar (otro flujo lo está atendiendo o el verificador ya se usó).
export async function completeAuthorizationRedirect(
  userId: string,
  params: AuthorizationParams,
): Promise<SpotifyTokens | null> {
  const taken = await takePending(userId, params)
  if (!taken) return null
  const clientId = getSpotifyClientId()
  if (!clientId) throw new SpotifyError('config')
  return exchangeCode({ code: taken.code, verifier: taken.pending.verifier, redirectUri: taken.pending.redirectUri, clientId })
}

// Igual que la anterior, pero para el login: devuelve el code para el back en vez de canjearlo.
export async function completeLoginRedirect(params: AuthorizationParams): Promise<SpotifyLoginGrant | null> {
  const taken = await takePending(LOGIN_PENDING_KEY, params)
  if (!taken) return null
  return {
    code: taken.code,
    codeVerifier: taken.pending.verifier,
    redirectUri: taken.pending.redirectUri,
    consentVersion: taken.pending.consentVersion ?? null,
  }
}
