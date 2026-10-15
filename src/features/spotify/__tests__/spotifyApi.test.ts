import { ApiError } from '@/lib/api/errors'
import { spotifyErrorFromStatus, spotifyTokenError, spotifyUserMessage } from '../errors'
import { getTopArtists, toImportPayload } from '../spotifyApi'

jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'encorely://spotify-callback') }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }))

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

function artist(name: unknown, genres?: unknown, id = String(name)) {
  return { id, name, genres, images: [{ url: 'https://i.scdn.co/x' }], popularity: 80 }
}

describe('toImportPayload', () => {
  test('sends name, genres and image, never the Spotify id or popularity', () => {
    expect(toImportPayload([artist('Bomba Estéreo', ['cumbia', 'electro'])])).toEqual({
      topArtists: [{ name: 'Bomba Estéreo', genres: ['cumbia', 'electro'], imageUrl: 'https://i.scdn.co/x' }],
    })
  })

  test('dedupes artists by name ignoring case and spaces, keeping the first', () => {
    const payload = toImportPayload([
      artist('Aterciopelados', ['rock en español']),
      artist(' aterciopelados ', ['otro'], 'other-id'),
      artist('Diamante Eléctrico', []),
    ])
    expect(payload.topArtists.map((a) => a.name)).toEqual(['Aterciopelados', 'Diamante Eléctrico'])
  })

  test('caps at 50 artists', () => {
    const items = Array.from({ length: 70 }, (_, i) => artist(`Artist ${i}`, ['pop']))
    const payload = toImportPayload(items)
    expect(payload.topArtists).toHaveLength(50)
    expect(payload.topArtists[49].name).toBe('Artist 49')
  })

  test('empty, missing or malformed genres become a clean array', () => {
    const payload = toImportPayload([
      artist('A', []),
      artist('B'),
      artist('C', 'rock'),
      artist('D', [' indie ', 'Indie', '', 42, null, 'shoegaze']),
    ])
    expect(payload.topArtists.map((a) => a.genres)).toEqual([[], [], [], ['indie', 'shoegaze']])
  })

  test('respects the backend limits for name length and genre count', () => {
    const genres = Array.from({ length: 30 }, (_, i) => `g${i}`)
    const [first] = toImportPayload([artist('x'.repeat(300), genres)]).topArtists
    expect(first.name).toHaveLength(200)
    expect(first.genres).toHaveLength(20)
  })

  test('sends the largest Spotify image only when it comes from the Spotify CDN', () => {
    const withImages = (images: unknown) => ({ ...artist('A', []), images })
    const payload = toImportPayload([
      withImages([{ url: 'https://i.scdn.co/image/big' }, { url: 'https://i.scdn.co/image/small' }]),
      { ...withImages([{ url: 'https://evil.example/x.png' }]), name: 'B' },
      { ...withImages('nope'), name: 'C' },
      { ...withImages([]), name: 'D' },
    ])
    expect(payload.topArtists).toEqual([
      { name: 'A', genres: [], imageUrl: 'https://i.scdn.co/image/big' },
      { name: 'B', genres: [] },
      { name: 'C', genres: [] },
      { name: 'D', genres: [] },
    ])
  })

  test('skips items without a usable name', () => {
    expect(toImportPayload([null, 'str', {}, artist(''), artist('   '), artist(7)]).topArtists).toEqual([])
  })
})

describe('getTopArtists', () => {
  test('reads medium_term top 50 with the bearer token', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [artist('A', [])] }) })
    await expect(getTopArtists('AT')).resolves.toHaveLength(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term')
    expect(init.headers.Authorization).toBe('Bearer AT')
  })

  test('a body without items is an empty list', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
    await expect(getTopArtists('AT')).resolves.toEqual([])
  })

  test('403 in development mode explains the test-user limit', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { status: 403 } }) })
    await expect(getTopArtists('AT')).rejects.toMatchObject({
      kind: 'devMode',
      message: 'Spotify limita esta función a cuentas de prueba mientras la app está en desarrollo.',
    })
  })

  test('no network', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(getTopArtists('AT')).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('error messages by HTTP status', () => {
  test.each([
    [401, 'auth', 'Spotify cerró el permiso. Vuelve a conectar tu cuenta.'],
    [403, 'devMode', 'Spotify limita esta función a cuentas de prueba mientras la app está en desarrollo.'],
    [429, 'rateLimited', 'Spotify está recibiendo demasiadas solicitudes. Espera un minuto e intenta otra vez.'],
    [500, 'server', 'Spotify no responde en este momento. Intenta de nuevo en un rato.'],
    [503, 'server', 'Spotify no responde en este momento. Intenta de nuevo en un rato.'],
    [404, 'unknown', 'No pudimos leer tu música de Spotify. Intenta otra vez.'],
  ])('%i → %s', (status, kind, message) => {
    const error = spotifyErrorFromStatus(status)
    expect(error).toMatchObject({ kind, status, message })
    expect(error.message).not.toMatch(/\d{3}/)
  })

  test('token endpoint errors use the OAuth error code', () => {
    expect(spotifyTokenError(400, 'invalid_grant').kind).toBe('auth')
    expect(spotifyTokenError(400, 'invalid_client').kind).toBe('config')
    expect(spotifyTokenError(400, undefined).kind).toBe('unknown')
    expect(spotifyTokenError(401, 'invalid_client').kind).toBe('config')
  })

  test('backend errors fall back to the API user message', () => {
    expect(spotifyUserMessage(new ApiError('network', 'x'))).toBe(
      'Sin conexión con el servidor. Revisa tu internet e intenta otra vez.',
    )
    expect(spotifyUserMessage(spotifyErrorFromStatus(403))).toContain('cuentas de prueba')
  })
})
