import { randomBytes } from '@noble/hashes/utils.js'

import { b64Decode, b64Encode, b64urlEncode, type RandomBytes } from '../crypto/bytes'
import { E2eeError } from '../crypto/errors'
import {
  generateBoxKeyPair,
  generateIdentityKeyPair,
  isValidBoxKeyId,
  signBoxKey,
  toPublicKeyBundle,
  type KeyPair,
  type PublicKeyBundle,
} from '../crypto/keyBundle'
import { assertSafeKeySegment, type KeyValueStore, type SecretStore } from './storage'

export interface DeviceKeysDeps {
  secure: SecretStore
  kv: KeyValueStore
  /** Test hook for deterministic keys. */
  randomBytes?: RandomBytes
}

export interface EnsureOptions {
  /** `boxKeyId` from GET /keys/me, or null on 404. */
  serverCurrentBoxKeyId: number | null
  /** Optional: identityKey/boxKey from GET /keys/me, to detect a server copy that is not ours. */
  serverIdentityKey?: string | null
  serverBoxKey?: string | null
}

export interface EnsureResult {
  bundle: PublicKeyBundle
  /** Fresh identity generated (first run, reinstall or wiped keys). */
  created: boolean
  /** A new box key was generated to get above the server's boxKeyId. */
  rotated: boolean
  /** Caller must PUT /keys/me with `bundle`. */
  needsUpload: boolean
}

export interface CurrentBoxKey {
  keyId: number
  secretKey: Uint8Array
  publicKey: Uint8Array
}

interface Meta {
  v: 1
  installId: string
  current: number
  keyIds: number[]
}

interface StoredBoxKey {
  sk: string
  pk: string
  sig: string
}

interface LoadedState {
  meta: Meta
  identity: KeyPair
}

function storageKeys(userId: string) {
  assertSafeKeySegment(userId)
  const prefix = `e2ee_v1_${userId}_`
  return {
    identity: `${prefix}identity`,
    meta: `${prefix}meta`,
    box: (keyId: number) => `${prefix}box_${keyId}`,
    installFlag: `${prefix}install_id`,
  }
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseMeta(raw: string | null): Meta | null {
  const value = parseJson(raw) as Partial<Meta> | null
  if (
    !value ||
    value.v !== 1 ||
    typeof value.installId !== 'string' ||
    !isValidBoxKeyId(value.current) ||
    !Array.isArray(value.keyIds) ||
    !value.keyIds.every(isValidBoxKeyId) ||
    !value.keyIds.includes(value.current)
  ) {
    return null
  }
  return value as Meta
}

function parseKeyPair(raw: string | null): KeyPair | null {
  const value = parseJson(raw) as { sk?: unknown; pk?: unknown } | null
  if (!value || typeof value.sk !== 'string' || typeof value.pk !== 'string') return null
  try {
    return { secretKey: b64Decode(value.sk), publicKey: b64Decode(value.pk) }
  } catch {
    return null
  }
}

function parseStoredBox(raw: string | null): StoredBoxKey | null {
  const value = parseJson(raw) as Partial<StoredBoxKey> | null
  if (!value || typeof value.sk !== 'string' || typeof value.pk !== 'string' || typeof value.sig !== 'string') {
    return null
  }
  return value as StoredBoxKey
}

function serverKeyId(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (!Number.isInteger(value) || value < 0) throw new E2eeError('invalid_input')
  return value
}

export function createDeviceKeys(deps: DeviceKeysDeps) {
  const { secure, kv } = deps
  const random = deps.randomBytes ?? randomBytes
  const locks = new Map<string, Promise<unknown>>()

  // Serializes per user so two screens calling ensureDeviceKeys at once cannot
  // generate two different identities.
  function withLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const previous = locks.get(userId) ?? Promise.resolve()
    const run = previous.catch(() => undefined).then(task)
    locks.set(userId, run)
    run
      .finally(() => {
        if (locks.get(userId) === run) locks.delete(userId)
      })
      .catch(() => undefined)
    return run
  }

  async function purge(userId: string, meta: Meta | null): Promise<void> {
    const keys = storageKeys(userId)
    for (const keyId of meta?.keyIds ?? []) await secure.deleteItem(keys.box(keyId))
    await secure.deleteItem(keys.meta)
    await secure.deleteItem(keys.identity)
    await kv.removeItem(keys.installFlag)
  }

  async function loadState(userId: string): Promise<LoadedState | null> {
    const keys = storageKeys(userId)
    const metaRaw = await secure.getItem(keys.meta)
    const identityRaw = await secure.getItem(keys.identity)
    if (metaRaw === null && identityRaw === null) return null

    const meta = parseMeta(metaRaw)
    const identity = parseKeyPair(identityRaw)
    const installFlag = await kv.getItem(keys.installFlag)
    // iOS keeps Keychain items across uninstall while AsyncStorage is wiped, so a missing
    // or foreign flag means these keys belong to a previous install: start over.
    if (!meta || !identity || installFlag === null || installFlag !== meta.installId) {
      await purge(userId, meta)
      return null
    }
    return { meta, identity }
  }

  async function readBox(userId: string, keyId: number): Promise<StoredBoxKey | null> {
    return parseStoredBox(await secure.getItem(storageKeys(userId).box(keyId)))
  }

  async function writeNewBoxKey(userId: string, identity: KeyPair, keyId: number): Promise<void> {
    const box = generateBoxKeyPair(random)
    const sig = signBoxKey(keyId, box.publicKey, identity.secretKey)
    const stored: StoredBoxKey = { sk: b64Encode(box.secretKey), pk: b64Encode(box.publicKey), sig: b64Encode(sig) }
    await secure.setItem(storageKeys(userId).box(keyId), JSON.stringify(stored))
  }

  async function bundleFor(userId: string, state: LoadedState): Promise<PublicKeyBundle> {
    const box = await readBox(userId, state.meta.current)
    if (!box) throw new E2eeError('missing_keys')
    return toPublicKeyBundle(state.identity.publicKey, b64Decode(box.pk), state.meta.current, b64Decode(box.sig))
  }

  async function rotateLocked(userId: string, state: LoadedState, serverCurrent: number): Promise<LoadedState> {
    const keyId = Math.max(...state.meta.keyIds, serverCurrent) + 1
    if (!isValidBoxKeyId(keyId)) throw new E2eeError('invalid_input')
    // Write the key before the index so a crash never leaves the index pointing at nothing.
    await writeNewBoxKey(userId, state.identity, keyId)
    const meta: Meta = { ...state.meta, current: keyId, keyIds: [...state.meta.keyIds, keyId] }
    await secure.setItem(storageKeys(userId).meta, JSON.stringify(meta))
    return { ...state, meta }
  }

  function ensureDeviceKeys(userId: string, options: EnsureOptions): Promise<EnsureResult> {
    return withLock(userId, async () => {
      const keys = storageKeys(userId)
      const serverCurrent = serverKeyId(options.serverCurrentBoxKeyId)
      const state = await loadState(userId)

      if (!state) {
        const identity = generateIdentityKeyPair(random)
        const keyId = serverCurrent + 1
        const meta: Meta = { v: 1, installId: b64urlEncode(random(16)), current: keyId, keyIds: [keyId] }
        await secure.setItem(
          keys.identity,
          JSON.stringify({ sk: b64Encode(identity.secretKey), pk: b64Encode(identity.publicKey) }),
        )
        await writeNewBoxKey(userId, identity, keyId)
        await secure.setItem(keys.meta, JSON.stringify(meta))
        // Flag last: if we die before this, the next run treats the keys as stale and regenerates.
        await kv.setItem(keys.installFlag, meta.installId)
        const created = { meta, identity }
        return { bundle: await bundleFor(userId, created), created: true, rotated: false, needsUpload: true }
      }

      let current = state
      let bundle = await bundleFor(userId, current)
      const serverDiffers =
        options.serverCurrentBoxKeyId === null ||
        options.serverCurrentBoxKeyId !== current.meta.current ||
        (options.serverIdentityKey != null && options.serverIdentityKey !== bundle.identityKey) ||
        (options.serverBoxKey != null && options.serverBoxKey !== bundle.boxKey)

      let rotated = false
      // The server only accepts strictly increasing boxKeyIds.
      if (serverDiffers && current.meta.current <= serverCurrent) {
        current = await rotateLocked(userId, current, serverCurrent)
        bundle = await bundleFor(userId, current)
        rotated = true
      }
      return { bundle, created: false, rotated, needsUpload: serverDiffers }
    })
  }

  function rotateBoxKey(userId: string, serverCurrentBoxKeyId: number | null): Promise<PublicKeyBundle> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state) throw new E2eeError('missing_keys')
      const next = await rotateLocked(userId, state, serverKeyId(serverCurrentBoxKeyId))
      return bundleFor(userId, next)
    })
  }

  function getBoxSecret(userId: string, keyId: number): Promise<Uint8Array | null> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state || !state.meta.keyIds.includes(keyId)) return null
      const box = await readBox(userId, keyId)
      return box ? b64Decode(box.sk) : null
    })
  }

  function currentBoxKey(userId: string): Promise<CurrentBoxKey | null> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state) return null
      const box = await readBox(userId, state.meta.current)
      if (!box) return null
      return { keyId: state.meta.current, secretKey: b64Decode(box.sk), publicKey: b64Decode(box.pk) }
    })
  }

  function publicBundle(userId: string): Promise<PublicKeyBundle | null> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      return state ? bundleFor(userId, state) : null
    })
  }

  function identityPublicKey(userId: string): Promise<Uint8Array | null> {
    return withLock(userId, async () => (await loadState(userId))?.identity.publicKey ?? null)
  }

  function listBoxKeyIds(userId: string): Promise<number[]> {
    return withLock(userId, async () => [...((await loadState(userId))?.meta.keyIds ?? [])])
  }

  /** Drops old box secrets (forward secrecy). The current key is always kept. Returns removed ids. */
  function pruneBoxKeys(userId: string, keepIds: number[]): Promise<number[]> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state) return []
      const keep = new Set([...keepIds, state.meta.current])
      const removed = state.meta.keyIds.filter((id) => !keep.has(id))
      if (removed.length === 0) return []
      const meta: Meta = { ...state.meta, keyIds: state.meta.keyIds.filter((id) => keep.has(id)) }
      // Index first: an orphaned secret is harmless, an index entry without its secret is not.
      await secure.setItem(storageKeys(userId).meta, JSON.stringify(meta))
      for (const id of removed) await secure.deleteItem(storageKeys(userId).box(id))
      return removed
    })
  }

  function wipeDeviceKeys(userId: string): Promise<void> {
    return withLock(userId, async () => {
      const meta = parseMeta(await secure.getItem(storageKeys(userId).meta))
      await purge(userId, meta)
    })
  }

  return {
    ensureDeviceKeys,
    rotateBoxKey,
    getBoxSecret,
    currentBoxKey,
    publicBundle,
    identityPublicKey,
    listBoxKeyIds,
    pruneBoxKeys,
    wipeDeviceKeys,
  }
}

export type DeviceKeys = ReturnType<typeof createDeviceKeys>
