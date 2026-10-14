import { randomBytes } from '@noble/hashes/utils.js'

import { b64Decode, b64Encode, b64urlEncode, type RandomBytes } from '../crypto/bytes'
import { boxKeyPairFromChain, newChainSeed, nextChainKey } from '../crypto/boxChain'
import { E2eeError } from '../crypto/errors'
import {
  generateIdentityKeyPair,
  isValidBoxKeyId,
  signBoxKey,
  toPublicKeyBundle,
  type KeyPair,
  type PublicKeyBundle,
} from '../crypto/keyBundle'
import { decodeKeyMaterial, wipeMaterial, type DecodedMaterial, type KeyMaterial } from './material'
import { assertSafeKeySegment, type KeyValueStore, type SecretStore } from './storage'

export interface DeviceKeysDeps {
  secure: SecretStore
  kv: KeyValueStore
  /** Test hook for deterministic keys. */
  randomBytes?: RandomBytes
  /** Test hook for the rotation clock. */
  now?: () => number
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

export interface KeyStatus {
  current: number
  keyIds: number[]
  hasChain: boolean
  rotatedAt: number | null
  /** Momento en que el servidor confirmó la caja vigente: desde ahí nadie puede cifrar a las anteriores. */
  publishedAt: number | null
}

interface Meta {
  v: 1
  installId: string
  current: number
  keyIds: number[]
  // Campos de la cadena (v1.1). Ausentes en instalaciones v1: la primera rotación arranca la cadena.
  chainKeyId?: number
  rotatedAt?: number
  publishedKeyId?: number
  publishedAt?: number
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

// Otro teléfono con la misma cadena (traspaso) pudo rotar varias veces sin que este se enterara.
const MAX_ADOPT_STEPS = 16

function storageKeys(userId: string) {
  assertSafeKeySegment(userId)
  const prefix = `e2ee_v1_${userId}_`
  return {
    identity: `${prefix}identity`,
    meta: `${prefix}meta`,
    chain: `${prefix}chain`,
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

const optionalTime = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value))

function parseMeta(raw: string | null): Meta | null {
  const value = parseJson(raw) as Partial<Meta> | null
  if (
    !value ||
    value.v !== 1 ||
    typeof value.installId !== 'string' ||
    !isValidBoxKeyId(value.current) ||
    !Array.isArray(value.keyIds) ||
    !value.keyIds.every(isValidBoxKeyId) ||
    !value.keyIds.includes(value.current) ||
    (value.chainKeyId !== undefined && !isValidBoxKeyId(value.chainKeyId)) ||
    (value.publishedKeyId !== undefined && !isValidBoxKeyId(value.publishedKeyId)) ||
    !optionalTime(value.rotatedAt) ||
    !optionalTime(value.publishedAt)
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
  const now = deps.now ?? Date.now
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
    await secure.deleteItem(keys.chain)
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

  async function readChain(userId: string, meta: Meta): Promise<Uint8Array | null> {
    if (meta.chainKeyId === undefined) return null
    const raw = await secure.getItem(storageKeys(userId).chain)
    if (raw === null) return null
    try {
      const chain = b64Decode(raw)
      return chain.length === 32 ? chain : null
    } catch {
      return null
    }
  }

  async function writeBoxKey(userId: string, identity: KeyPair, keyId: number, box: KeyPair): Promise<void> {
    const sig = signBoxKey(keyId, box.publicKey, identity.secretKey)
    const stored: StoredBoxKey = { sk: b64Encode(box.secretKey), pk: b64Encode(box.publicKey), sig: b64Encode(sig) }
    await secure.setItem(storageKeys(userId).box(keyId), JSON.stringify(stored))
  }

  async function writeMeta(userId: string, meta: Meta): Promise<void> {
    await secure.setItem(storageKeys(userId).meta, JSON.stringify(meta))
  }

  async function bundleFor(userId: string, state: LoadedState): Promise<PublicKeyBundle> {
    const box = await readBox(userId, state.meta.current)
    if (!box) throw new E2eeError('missing_keys')
    return toPublicKeyBundle(state.identity.publicKey, b64Decode(box.pk), state.meta.current, b64Decode(box.sig))
  }

  /**
   * Siguiente eslabón: chain_{n+1} reemplaza a chain_n en el llavero (el viejo deja de existir) y su caja queda
   * como vigente. Sin cadena (instalación v1 o llaves aleatorias) arranca una nueva desde una semilla aleatoria.
   */
  async function rotateLocked(userId: string, state: LoadedState, serverCurrent: number): Promise<LoadedState> {
    const keyId = Math.max(...state.meta.keyIds, serverCurrent) + 1
    if (!isValidBoxKeyId(keyId)) throw new E2eeError('invalid_input')
    const previous = await readChain(userId, state.meta)
    const chain = previous ? nextChainKey(previous) : newChainSeed(random)
    previous?.fill(0)
    const box = boxKeyPairFromChain(chain)
    // Orden pensado para un cierre a mitad: caja, luego cadena, luego índice. El índice nunca apunta a algo
    // que no existe; en el peor caso se salta un eslabón, que no rompe nada.
    await writeBoxKey(userId, state.identity, keyId, box)
    await secure.setItem(storageKeys(userId).chain, b64Encode(chain))
    chain.fill(0)
    box.secretKey.fill(0)
    const meta: Meta = {
      ...state.meta,
      current: keyId,
      keyIds: [...state.meta.keyIds, keyId],
      chainKeyId: keyId,
      rotatedAt: now(),
      publishedKeyId: undefined,
      publishedAt: undefined,
    }
    await writeMeta(userId, meta)
    return { ...state, meta }
  }

  /**
   * El servidor tiene una caja más nueva con MI identidad: otro teléfono con la misma cadena (traspaso) rotó.
   * Si la cadena local llega a esa misma caja, se adopta sin subir nada; si no, null y se rota como siempre.
   */
  async function adoptLocked(
    userId: string,
    state: LoadedState,
    serverCurrent: number,
    serverBoxKey: string,
  ): Promise<LoadedState | null> {
    const start = await readChain(userId, state.meta)
    if (!start) return null
    let chain = start
    for (let step = 0; step < MAX_ADOPT_STEPS; step++) {
      const next = nextChainKey(chain)
      chain.fill(0)
      chain = next
      const box = boxKeyPairFromChain(chain)
      if (b64Encode(box.publicKey) !== serverBoxKey) {
        box.secretKey.fill(0)
        continue
      }
      await writeBoxKey(userId, state.identity, serverCurrent, box)
      await secure.setItem(storageKeys(userId).chain, b64Encode(chain))
      box.secretKey.fill(0)
      chain.fill(0)
      const at = now()
      const meta: Meta = {
        ...state.meta,
        current: serverCurrent,
        keyIds: [...state.meta.keyIds.filter((id) => id !== serverCurrent), serverCurrent],
        chainKeyId: serverCurrent,
        rotatedAt: at,
        publishedKeyId: serverCurrent,
        publishedAt: at,
      }
      await writeMeta(userId, meta)
      return { ...state, meta }
    }
    chain.fill(0)
    return null
  }

  function ensureDeviceKeys(userId: string, options: EnsureOptions): Promise<EnsureResult> {
    return withLock(userId, async () => {
      const keys = storageKeys(userId)
      const serverCurrent = serverKeyId(options.serverCurrentBoxKeyId)
      const state = await loadState(userId)

      if (!state) {
        const identity = generateIdentityKeyPair(random)
        const keyId = serverCurrent + 1
        const chain = newChainSeed(random)
        const meta: Meta = {
          v: 1,
          installId: b64urlEncode(random(16)),
          current: keyId,
          keyIds: [keyId],
          chainKeyId: keyId,
          rotatedAt: now(),
        }
        await secure.setItem(
          keys.identity,
          JSON.stringify({ sk: b64Encode(identity.secretKey), pk: b64Encode(identity.publicKey) }),
        )
        const box = boxKeyPairFromChain(chain)
        await writeBoxKey(userId, identity, keyId, box)
        await secure.setItem(keys.chain, b64Encode(chain))
        chain.fill(0)
        box.secretKey.fill(0)
        await writeMeta(userId, meta)
        // Flag last: if we die before this, the next run treats the keys as stale and regenerates.
        await kv.setItem(keys.installFlag, meta.installId)
        const created = { meta, identity }
        return { bundle: await bundleFor(userId, created), created: true, rotated: false, needsUpload: true }
      }

      let current = state
      let bundle = await bundleFor(userId, current)
      const sameIdentity = options.serverIdentityKey != null && options.serverIdentityKey === bundle.identityKey
      if (sameIdentity && options.serverBoxKey != null && serverCurrent > current.meta.current) {
        const adopted = await adoptLocked(userId, current, serverCurrent, options.serverBoxKey)
        if (adopted) {
          return { bundle: await bundleFor(userId, adopted), created: false, rotated: false, needsUpload: false }
        }
      }

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

  /** Rotación periódica pendiente: nunca rotó con cadena, o pasó el intervalo desde la última. */
  function rotationDue(userId: string, intervalMs: number): Promise<boolean> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state) return false
      const { chainKeyId, rotatedAt } = state.meta
      return chainKeyId === undefined || rotatedAt === undefined || now() - rotatedAt >= intervalMs
    })
  }

  /** El servidor aceptó (o ya tenía) la caja `keyId`. Solo cuenta si sigue siendo la vigente. */
  function markPublished(userId: string, keyId: number): Promise<void> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state || state.meta.current !== keyId || state.meta.publishedKeyId === keyId) return
      await writeMeta(userId, { ...state.meta, publishedKeyId: keyId, publishedAt: now() })
    })
  }

  function keyStatus(userId: string): Promise<KeyStatus | null> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state) return null
      const { meta } = state
      return {
        current: meta.current,
        keyIds: [...meta.keyIds],
        hasChain: meta.chainKeyId !== undefined,
        rotatedAt: meta.rotatedAt ?? null,
        publishedAt: meta.publishedKeyId === meta.current ? (meta.publishedAt ?? null) : null,
      }
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
      await writeMeta(userId, meta)
      for (const id of removed) await secure.deleteItem(storageKeys(userId).box(id))
      return removed
    })
  }

  /** Todo lo que un respaldo o un traspaso necesita para que otro teléfono lea y escriba como este. */
  function exportMaterial(userId: string): Promise<KeyMaterial> {
    return withLock(userId, async () => {
      const state = await loadState(userId)
      if (!state) throw new E2eeError('missing_keys')
      const boxKeys: KeyMaterial['boxKeys'] = []
      for (const id of state.meta.keyIds) {
        const box = await readBox(userId, id)
        if (box) boxKeys.push({ id, sk: box.sk, pk: box.pk, sig: box.sig })
      }
      const chain = await readChain(userId, state.meta)
      const material: KeyMaterial = {
        v: 1,
        identity: { sk: b64Encode(state.identity.secretKey), pk: b64Encode(state.identity.publicKey) },
        chain: chain ? b64Encode(chain) : null,
        chainKeyId: chain ? (state.meta.chainKeyId ?? null) : null,
        current: state.meta.current,
        rotatedAt: state.meta.rotatedAt ?? null,
        boxKeys,
      }
      chain?.fill(0)
      return material
    })
  }

  /**
   * Instala material de un respaldo o de otro teléfono. Misma identidad: se suman las cajas que falten y gana
   * la cadena más avanzada. Otra identidad: reemplaza todo (las llaves que este teléfono generó solo
   * desaparecen). Valida antes de tocar nada. No publica: eso lo hace quien llama.
   */
  async function importMaterial(userId: string, material: KeyMaterial): Promise<PublicKeyBundle> {
    const decoded: DecodedMaterial = decodeKeyMaterial(material)
    return withLock(userId, async () => {
      const keys = storageKeys(userId)
      try {
        const state = await loadState(userId)
        const merge = state !== null && b64Encode(state.identity.publicKey) === b64Encode(decoded.identity.publicKey)
        if (state && !merge) await purge(userId, state.meta)

        const base: Meta = merge
          ? state!.meta
          : { v: 1, installId: b64urlEncode(random(16)), current: decoded.current, keyIds: [] }
        const keyIds = new Set(base.keyIds)
        for (const box of decoded.boxKeys) {
          if (keyIds.has(box.id)) continue
          const stored: StoredBoxKey = { sk: b64Encode(box.secretKey), pk: b64Encode(box.publicKey), sig: b64Encode(box.sig) }
          await secure.setItem(keys.box(box.id), JSON.stringify(stored))
          keyIds.add(box.id)
        }
        if (!merge) {
          await secure.setItem(
            keys.identity,
            JSON.stringify({ sk: b64Encode(decoded.identity.secretKey), pk: b64Encode(decoded.identity.publicKey) }),
          )
        }

        const incomingChainWins =
          decoded.chain !== null && (base.chainKeyId === undefined || (decoded.chainKeyId ?? 0) > base.chainKeyId)
        if (incomingChainWins) await secure.setItem(keys.chain, b64Encode(decoded.chain!))
        const current = Math.max(merge ? base.current : 0, decoded.current)
        const meta: Meta = {
          ...base,
          current,
          keyIds: [...keyIds].sort((a, b) => a - b),
          chainKeyId: incomingChainWins ? decoded.chainKeyId! : base.chainKeyId,
          rotatedAt: incomingChainWins ? (decoded.rotatedAt ?? undefined) : base.rotatedAt,
          publishedKeyId: undefined,
          publishedAt: undefined,
        }
        await writeMeta(userId, meta)
        await kv.setItem(keys.installFlag, meta.installId)
        const installed = await loadState(userId)
        if (!installed) throw new E2eeError('missing_keys')
        return bundleFor(userId, installed)
      } finally {
        wipeMaterial(decoded)
      }
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
    rotationDue,
    markPublished,
    keyStatus,
    getBoxSecret,
    currentBoxKey,
    publicBundle,
    identityPublicKey,
    listBoxKeyIds,
    pruneBoxKeys,
    exportMaterial,
    importMaterial,
    wipeDeviceKeys,
  }
}

export type DeviceKeys = ReturnType<typeof createDeviceKeys>
