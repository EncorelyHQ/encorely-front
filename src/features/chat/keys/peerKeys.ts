import { E2eeError } from '../crypto/errors'
import { verifyBoxKey, type PeerKeyBundle, type VerifiedBoxKey } from '../crypto/keyBundle'
import type { KeyValueStore } from './storage'

export type PeerTrustState = 'unverified' | 'verified' | 'changed'

export interface PinnedPeer {
  v: 1
  userId: string
  /** Accepted identity key (base64). Stays the old one while a change is pending. */
  identityKey: string
  state: PeerTrustState
  /** Identity the server now serves that the user has not accepted yet (state 'changed'). */
  pendingIdentityKey?: string
  /** State before the change. 'verified' means sending is blocked until acceptChange. */
  changedFrom?: 'unverified' | 'verified'
  /** Identities accepted earlier, kept so history signed by them still decrypts. */
  previousIdentityKeys: string[]
  /** Highest current boxKeyId seen; boxKeyIds are global per user, so they only grow. */
  maxBoxKeyId: number
  updatedAt: number
}

export type PeerKeyEvent = 'first_seen' | 'unchanged' | 'rotated' | 'identity_changed'

export interface PeerEvaluation {
  pinned: PinnedPeer
  event: PeerKeyEvent
  /** Previously verified contact changed identity: block sending until the user confirms. */
  requiresConfirmation: boolean
  /** Whether encrypting to `verified.boxKey` is allowed right now. */
  canSend: boolean
  /** Server served a lower boxKeyId than already seen as current (possible rollback). */
  staleBoxKey: boolean
  verified: VerifiedBoxKey
}

function blocksSending(pinned: PinnedPeer): boolean {
  return pinned.state === 'changed' && pinned.changedFrom === 'verified'
}

/**
 * Trust-on-first-use pinning for the peer's *current* bundle (GET /matches/{id}/peer-keys).
 * Throws E2eeError if the bundle's own signature is invalid: fail closed.
 */
export function evaluatePeerBundle(
  pinned: PinnedPeer | null,
  incoming: PeerKeyBundle,
  now: number = Date.now(),
): PeerEvaluation {
  const verified = verifyBoxKey(incoming)
  if (pinned && pinned.userId !== incoming.userId) throw new E2eeError('identity_mismatch')

  if (!pinned) {
    return {
      pinned: {
        v: 1,
        userId: incoming.userId,
        identityKey: incoming.identityKey,
        state: 'unverified',
        previousIdentityKeys: [],
        maxBoxKeyId: incoming.boxKeyId,
        updatedAt: now,
      },
      event: 'first_seen',
      requiresConfirmation: false,
      canSend: true,
      staleBoxKey: false,
      verified,
    }
  }

  const maxBoxKeyId = Math.max(pinned.maxBoxKeyId, incoming.boxKeyId)
  const staleBoxKey = incoming.boxKeyId < pinned.maxBoxKeyId

  if (incoming.identityKey === pinned.identityKey) {
    // Same identity with a new, validly signed box key is a rotation, not a change.
    // If a pending change existed, the server went back to the accepted identity: drop it.
    const next: PinnedPeer = {
      ...pinned,
      state: pinned.state === 'changed' ? (pinned.changedFrom ?? 'unverified') : pinned.state,
      pendingIdentityKey: undefined,
      changedFrom: undefined,
      maxBoxKeyId,
      updatedAt: now,
    }
    return {
      pinned: next,
      event: incoming.boxKeyId > pinned.maxBoxKeyId ? 'rotated' : 'unchanged',
      requiresConfirmation: false,
      canSend: !staleBoxKey,
      staleBoxKey,
      verified,
    }
  }

  const changedFrom = pinned.state === 'changed' ? (pinned.changedFrom ?? 'unverified') : pinned.state
  const next: PinnedPeer = {
    ...pinned,
    state: 'changed',
    pendingIdentityKey: incoming.identityKey,
    changedFrom,
    maxBoxKeyId,
    updatedAt: now,
  }
  const requiresConfirmation = changedFrom === 'verified'
  return {
    pinned: next,
    event: 'identity_changed',
    requiresConfirmation,
    canSend: !requiresConfirmation && !staleBoxKey,
    staleBoxKey,
    verified,
  }
}

/**
 * For historical box keys (GET /peer-keys/box/{id}) used to decrypt old messages:
 * valid signature by an identity this peer has had. Returns null when untrusted.
 */
export function trustHistoricalBoxKey(pinned: PinnedPeer, bundle: PeerKeyBundle): VerifiedBoxKey | null {
  if (bundle.userId !== pinned.userId) return null
  let verified: VerifiedBoxKey
  try {
    verified = verifyBoxKey(bundle)
  } catch {
    return null
  }
  const trusted =
    bundle.identityKey === pinned.identityKey ||
    pinned.previousIdentityKeys.includes(bundle.identityKey) ||
    (bundle.identityKey === pinned.pendingIdentityKey && !blocksSending(pinned))
  return trusted ? verified : null
}

export function acceptChange(pinned: PinnedPeer, now: number = Date.now()): PinnedPeer {
  if (pinned.state !== 'changed' || !pinned.pendingIdentityKey) throw new E2eeError('invalid_input')
  const previous = pinned.previousIdentityKeys.includes(pinned.identityKey)
    ? pinned.previousIdentityKeys
    : [...pinned.previousIdentityKeys, pinned.identityKey]
  return {
    ...pinned,
    identityKey: pinned.pendingIdentityKey,
    state: 'unverified',
    pendingIdentityKey: undefined,
    changedFrom: undefined,
    previousIdentityKeys: previous,
    updatedAt: now,
  }
}

/**
 * `verifiedIdentityKey` is the key the safety code/QR was computed from, so a change that
 * lands while the user is comparing codes cannot be marked verified by mistake.
 */
export function markVerified(pinned: PinnedPeer, verifiedIdentityKey: string, now: number = Date.now()): PinnedPeer {
  if (pinned.state === 'changed' && verifiedIdentityKey === pinned.pendingIdentityKey) {
    return { ...acceptChange(pinned, now), state: 'verified' }
  }
  if (pinned.state !== 'changed' && verifiedIdentityKey === pinned.identityKey) {
    return { ...pinned, state: 'verified', updatedAt: now }
  }
  throw new E2eeError('identity_mismatch')
}

function parsePinned(raw: string | null): PinnedPeer | null {
  if (raw === null) return null
  try {
    const value = JSON.parse(raw) as PinnedPeer
    if (value?.v !== 1 || typeof value.identityKey !== 'string' || !Array.isArray(value.previousIdentityKeys)) {
      return null
    }
    return value
  } catch {
    return null
  }
}

export function createPeerKeyStore(kv: KeyValueStore) {
  const keyFor = (myUserId: string, peerUserId: string) => `e2ee_v1_${myUserId}_peer_${peerUserId}`

  async function get(myUserId: string, peerUserId: string): Promise<PinnedPeer | null> {
    return parsePinned(await kv.getItem(keyFor(myUserId, peerUserId)))
  }

  async function save(myUserId: string, pinned: PinnedPeer): Promise<void> {
    await kv.setItem(keyFor(myUserId, pinned.userId), JSON.stringify(pinned))
  }

  async function update(
    myUserId: string,
    peerUserId: string,
    change: (pinned: PinnedPeer) => PinnedPeer,
  ): Promise<PinnedPeer> {
    const pinned = await get(myUserId, peerUserId)
    if (!pinned) throw new E2eeError('missing_keys')
    const next = change(pinned)
    await save(myUserId, next)
    return next
  }

  return {
    get,
    save,
    /** Evaluates the peer's current bundle against the pin and persists the result. */
    async evaluate(myUserId: string, incoming: PeerKeyBundle, now?: number): Promise<PeerEvaluation> {
      const evaluation = evaluatePeerBundle(await get(myUserId, incoming.userId), incoming, now)
      await save(myUserId, evaluation.pinned)
      return evaluation
    },
    markVerified: (myUserId: string, peerUserId: string, verifiedIdentityKey: string) =>
      update(myUserId, peerUserId, (pinned) => markVerified(pinned, verifiedIdentityKey)),
    acceptChange: (myUserId: string, peerUserId: string) =>
      update(myUserId, peerUserId, (pinned) => acceptChange(pinned)),
    remove: (myUserId: string, peerUserId: string) => kv.removeItem(keyFor(myUserId, peerUserId)),
  }
}

export type PeerKeyStore = ReturnType<typeof createPeerKeyStore>
