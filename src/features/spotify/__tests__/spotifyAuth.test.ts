import * as WebBrowser from 'expo-web-browser'
import { isSpotifyError } from '../errors'
import { parseQuery } from '../http'
import {
  authorizeWithSpotify,
  buildAuthorizeUrl,
  challengeFromVerifier,
  completeAuthorizationRedirect,
  createState,
  createVerifier,
  paramsFromUrl,
  readAuthorizationCode,
  refreshAccessToken,
} from '../spotifyAuth'
import { loadPending, PENDING_TTL_MS, savePending } from '../storage'

const mockMemory = new Map<string, string>()

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
  getItemAsync: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockMemory.set(key, value)
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockMemory.delete(key)
  }),
}))

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto')
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { BASE64: 'base64' },
    getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(nodeCrypto.randomBytes(n))),
    digestStringAsync: jest.fn(async (_alg: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data).digest('base64'),
    ),
  }
})

jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'encorely://spotify-callback') }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { spotifyClientId: 'client-123' } } } }))
jest.mock('@/lib/session/SessionContext', () => ({ registerSignOutTask: jest.fn() }))

// Sin @types/node en el proyecto: tipamos a mano lo poco que usamos del crypto de Node.
type NodeHash = { update: (data: string) => { digest: (encoding: string) => string } }
const { createHash } = jest.requireActual('crypto') as { createHash: (algorithm: string) => NodeHash }

const USER = '11111111-2222-4333-8444-555555555555'
const REDIRECT = 'encorely://spotify-callback'
const openAuth = WebBrowser.openAuthSessionAsync as jest.Mock
const fetchMock = jest.fn()

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const tokenBody = { access_token: 'AT-secret', refresh_token: 'RT-secret', expires_in: 3600 }

beforeEach(() => {
  mockMemory.clear()
  openAuth.mockReset()
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

describe('PKCE', () => {
  test('S256 challenge matches the RFC 7636 appendix B vector', async () => {
    await expect(challengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  test('verifier and state are base64url without padding and long enough', async () => {
    const verifier = await createVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const state = await createState()
    expect(state).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(await createState()).not.toBe(state)
  })
})

describe('buildAuthorizeUrl', () => {
  test('requests only user-top-read, S256 and carries the state', () => {
    const url = buildAuthorizeUrl({ clientId: 'client-123', redirectUri: REDIRECT, challenge: 'CH', state: 'ST' })
    expect(url.startsWith('https://accounts.spotify.com/authorize?')).toBe(true)
    const params = parseQuery(url)
    expect(params).toEqual({
      client_id: 'client-123',
      response_type: 'code',
      redirect_uri: REDIRECT,
      scope: 'user-top-read',
      code_challenge_method: 'S256',
      code_challenge: 'CH',
      state: 'ST',
    })
    expect(url).toContain('redirect_uri=encorely%3A%2F%2Fspotify-callback')
  })
})

describe('readAuthorizationCode (state validation)', () => {
  test('returns the code when state matches', () => {
    expect(readAuthorizationCode({ code: 'c1', state: 'abc' }, 'abc')).toBe('c1')
  })

  test.each([
    ['missing state', { code: 'c1' }],
    ['different state', { code: 'c1', state: 'evil' }],
    ['forged error without state', { error: 'access_denied' }],
  ])('rejects %s as CSRF', (_name, params) => {
    expect(() => readAuthorizationCode(params, 'abc')).toThrow(
      expect.objectContaining({ kind: 'state' }) as unknown as Error,
    )
  })

  test('access_denied with a valid state is a denial, not a crash', () => {
    expect(() => readAuthorizationCode({ error: 'access_denied', state: 'abc' }, 'abc')).toThrow(
      expect.objectContaining({ kind: 'denied' }) as unknown as Error,
    )
  })

  test('parses the redirect URL', () => {
    expect(paramsFromUrl(`${REDIRECT}?code=a%2Bb&state=x#_=_`)).toEqual({ code: 'a+b', state: 'x', error: undefined })
  })
})

describe('authorizeWithSpotify', () => {
  test('opens the browser, validates state and exchanges the code with the stored verifier', async () => {
    let authorizeUrl = ''
    openAuth.mockImplementation(async (url: string, redirect: string) => {
      authorizeUrl = url
      expect(redirect).toBe(REDIRECT)
      // Mientras el navegador está abierto, el verificador ya está en SecureStore para poder reanudar.
      expect(await loadPending(USER)).not.toBeNull()
      return { type: 'success', url: `${REDIRECT}?code=the-code&state=${parseQuery(url).state}` }
    })
    fetchMock.mockResolvedValueOnce(jsonResponse(200, tokenBody))
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    const tokens = await authorizeWithSpotify(USER)

    expect(tokens).toEqual({ accessToken: 'AT-secret', refreshToken: 'RT-secret', expiresIn: 3600 })
    const [tokenUrl, init] = fetchMock.mock.calls[0]
    expect(tokenUrl).toBe('https://accounts.spotify.com/api/token')
    const body = parseQuery(`?${init.body}`)
    expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'the-code', redirect_uri: REDIRECT, client_id: 'client-123' })
    const challenge = parseQuery(authorizeUrl).code_challenge
    expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(challenge)
    expect(await loadPending(USER)).toBeNull()
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  test('a state mismatch never reaches the token endpoint', async () => {
    openAuth.mockResolvedValue({ type: 'success', url: `${REDIRECT}?code=stolen&state=forged` })
    await expect(authorizeWithSpotify(USER)).rejects.toMatchObject({ kind: 'state' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await loadPending(USER)).toBeNull()
  })

  test.each(['cancel', 'dismiss', 'locked'])('browser result %s is reported as cancelled', async (type) => {
    openAuth.mockResolvedValue({ type })
    await expect(authorizeWithSpotify(USER)).rejects.toMatchObject({ kind: 'cancelled' })
    expect(await loadPending(USER)).toBeNull()
  })

  test('invalid_grant from the token endpoint maps to auth', async () => {
    openAuth.mockImplementation(async (url: string) => ({
      type: 'success',
      url: `${REDIRECT}?code=c&state=${parseQuery(url).state}`,
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'invalid_grant', error_description: 'Invalid authorization code' }))
    const error = await authorizeWithSpotify(USER).catch((e: unknown) => e)
    expect(isSpotifyError(error, 'auth')).toBe(true)
    // El mensaje es humano y no repite el cuerpo de Spotify.
    expect((error as Error).message).not.toContain('Invalid authorization code')
  })
})

describe('completeAuthorizationRedirect (resume after Android kills the app)', () => {
  test('uses the stored verifier once', async () => {
    await savePending(USER, { verifier: 'v'.repeat(43), state: 'st', redirectUri: REDIRECT, createdAt: Date.now() })
    fetchMock.mockResolvedValue(jsonResponse(200, tokenBody))

    const tokens = await completeAuthorizationRedirect(USER, { code: 'c', state: 'st' })
    expect(tokens?.accessToken).toBe('AT-secret')
    expect(parseQuery(`?${fetchMock.mock.calls[0][1].body}`).code_verifier).toBe('v'.repeat(43))

    await expect(completeAuthorizationRedirect(USER, { code: 'c', state: 'st' })).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('rejects a mismatched state and an expired attempt', async () => {
    await savePending(USER, { verifier: 'v', state: 'st', redirectUri: REDIRECT, createdAt: Date.now() })
    await expect(completeAuthorizationRedirect(USER, { code: 'c', state: 'other' })).rejects.toMatchObject({ kind: 'state' })

    await savePending(USER, { verifier: 'v', state: 'st', redirectUri: REDIRECT, createdAt: Date.now() - PENDING_TTL_MS - 1 })
    await expect(completeAuthorizationRedirect(USER, { code: 'c', state: 'st' })).rejects.toMatchObject({ kind: 'expired' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('refreshAccessToken', () => {
  test('keeps refreshToken null when Spotify does not rotate it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { access_token: 'AT2', expires_in: 3600 }))
    await expect(refreshAccessToken('RT-old', 'client-123')).resolves.toEqual({
      accessToken: 'AT2',
      refreshToken: null,
      expiresIn: 3600,
    })
    expect(parseQuery(`?${fetchMock.mock.calls[0][1].body}`)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'RT-old',
      client_id: 'client-123',
    })
  })

  test('network failure is reported as network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(refreshAccessToken('RT', 'client-123')).rejects.toMatchObject({ kind: 'network' })
  })
})
