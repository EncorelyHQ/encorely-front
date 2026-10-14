import { ApiError } from '@/lib/api/errors'
import { verifyBoxKey } from '../../crypto'
import { createFakeChatServer, createTestDeps } from '../../__fixtures__/fakeChatServer'
import { ensureKeysPublished, forgetPublishedKeys } from '../publishKeys'

const ME = '0b6f1c1e-0000-4000-8000-0000000000aa'

afterEach(() => forgetPublishedKeys())

describe('ensureKeysPublished', () => {
  test('primer inicio (GET /keys/me 404): genera y publica con boxKeyId 1', async () => {
    const server = createFakeChatServer()
    const deps = createTestDeps(server, ME, 'pub-1')
    await ensureKeysPublished(deps, ME)
    const published = server.keysOf(ME)!
    expect(published.boxKeyId).toBe(1)
    expect(verifyBoxKey(published).boxKeyId).toBe(1)
  })

  test('ya publicado y sin cambios: no vuelve a subir; una sola publicación por arranque', async () => {
    const server = createFakeChatServer()
    const deps = createTestDeps(server, ME, 'pub-2')
    await ensureKeysPublished(deps, ME)
    const publish = jest.spyOn(deps.transport, 'publishKeys')
    await ensureKeysPublished(deps, ME)
    await ensureKeysPublished(deps, ME, true)
    expect(publish).not.toHaveBeenCalled()
  })

  test('reinstalación: identidad nueva por encima del boxKeyId del servidor', async () => {
    const server = createFakeChatServer()
    const before = createTestDeps(server, ME, 'pub-3a')
    await ensureKeysPublished(before, ME)
    forgetPublishedKeys()
    const after = createTestDeps(server, ME, 'pub-3b')
    await ensureKeysPublished(after, ME)
    const published = server.keysOf(ME)!
    expect(published.boxKeyId).toBe(2)
    expect(published.identityKey).toBe((await after.deviceKeys.publicBundle(ME))!.identityKey)
  })

  test('409 stale_box_key_id: rota por encima del último del servidor y reintenta', async () => {
    const server = createFakeChatServer()
    const deps = createTestDeps(server, ME, 'pub-4')
    const real = deps.transport.myKeys
    // GET /keys/me se queda corto (réplica atrasada) mientras otro teléfono ya publicó el 5.
    const other = createTestDeps(server, ME, 'pub-4-other')
    await ensureKeysPublished(other, ME)
    for (let i = 0; i < 4; i++) {
      await other.transport.publishKeys(await other.deviceKeys.rotateBoxKey(ME, server.keysOf(ME)!.boxKeyId))
    }
    expect(server.keysOf(ME)!.boxKeyId).toBe(5)
    let first = true
    deps.transport.myKeys = async () => {
      if (first) {
        first = false
        throw new ApiError('http', 'not_found', { status: 404 })
      }
      return real()
    }
    await ensureKeysPublished(deps, ME)
    expect(server.keysOf(ME)!.boxKeyId).toBe(6)
    expect(server.keysOf(ME)!.identityKey).toBe((await deps.deviceKeys.publicBundle(ME))!.identityKey)
  })
})
