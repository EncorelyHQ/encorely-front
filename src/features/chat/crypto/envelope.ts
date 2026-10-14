import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'

import {
  b64Decode,
  b64DecodeLength,
  b64Encode,
  concat,
  constantTimeEqual,
  u32be,
  u8,
  utf8,
  utf8Decode,
  type RandomBytes,
} from './bytes'
import { E2eeError } from './errors'
import { isValidBoxKeyId } from './keyBundle'
import { pad, unpad } from './padding'
import { deriveChatKey } from './pairKey'

export const MESSAGE_VERSION = 1

const AAD_CONTEXT = utf8('ENCORELY-MSG-v1')
const SEPARATOR = Uint8Array.of(0)
const NONCE_LENGTH = 24
const FRANKING_KEY_LENGTH = 32
const FRANKING_TAG_LENGTH = 32

export type MessageKind = 'text' | 'system'

/** Wire shape of POST /matches/{id}/messages (and the crypto part of GET items). */
export interface MessageEnvelope {
  id: string
  version: number
  senderBoxKeyId: number
  recipientBoxKeyId: number
  nonce: string
  ciphertext: string
  frankingTag?: string
}

/** Either a pre-derived chat key (cacheable) or the raw material to derive it. */
export type PairKeyMaterial = { chatKey: Uint8Array } | { mySecret: Uint8Array; peerBoxPublic: Uint8Array }

export type SealInput = PairKeyMaterial & {
  id: string
  matchId: string
  senderId: string
  recipientId: string
  sentAt: number
  kind: MessageKind
  body: string
  senderBoxKeyId: number
  recipientBoxKeyId: number
}

export type OpenContext = PairKeyMaterial & {
  matchId: string
  /** Sender as reported by the server; the inner payload must agree. */
  senderId: string
  recipientId: string
}

export interface OpenedMessage {
  id: string
  matchId: string
  senderId: string
  sentAt: number
  kind: MessageKind
  body: string
  /** Exact inner plaintext; send as `plaintext` in report evidence. */
  p: string
  /** Franking key (base64); send as `frankingKey` in report evidence. */
  fk: string
}

interface InnerPayload {
  v: number
  id: string
  m: string
  s: string
  r: string
  t: number
  k: MessageKind
  b: string
}

export interface SealOptions {
  /** Test hook for deterministic vectors. Never pass in production code. */
  randomBytes?: RandomBytes
}

function assertIdentifier(value: unknown): asserts value is string {
  // NUL is the AAD field separator, so allowing it would make two different
  // (id, matchId, senderId) tuples serialize to the same bytes.
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new E2eeError('invalid_input')
  }
}

function resolveChatKey(material: PairKeyMaterial, matchId: string): Uint8Array {
  if ('chatKey' in material) {
    if (!(material.chatKey instanceof Uint8Array) || material.chatKey.length !== 32) {
      throw new E2eeError('invalid_key')
    }
    return material.chatKey
  }
  return deriveChatKey(material.mySecret, material.peerBoxPublic, matchId)
}

export function buildAad(
  version: number,
  id: string,
  matchId: string,
  senderId: string,
  senderBoxKeyId: number,
  recipientBoxKeyId: number,
): Uint8Array {
  assertIdentifier(id)
  assertIdentifier(matchId)
  assertIdentifier(senderId)
  return concat(
    AAD_CONTEXT,
    u8(version),
    utf8(id),
    SEPARATOR,
    utf8(matchId),
    SEPARATOR,
    utf8(senderId),
    SEPARATOR,
    u32be(senderBoxKeyId),
    u32be(recipientBoxKeyId),
  )
}

export function sealMessage(input: SealInput, options: SealOptions = {}): MessageEnvelope {
  const random = options.randomBytes ?? randomBytes
  assertIdentifier(input.id)
  assertIdentifier(input.matchId)
  assertIdentifier(input.senderId)
  assertIdentifier(input.recipientId)
  if (
    !isValidBoxKeyId(input.senderBoxKeyId) ||
    !isValidBoxKeyId(input.recipientBoxKeyId) ||
    !Number.isSafeInteger(input.sentAt) ||
    (input.kind !== 'text' && input.kind !== 'system') ||
    typeof input.body !== 'string'
  ) {
    throw new E2eeError('invalid_input')
  }

  const key = resolveChatKey(input, input.matchId)
  const inner: InnerPayload = {
    v: MESSAGE_VERSION,
    id: input.id,
    m: input.matchId,
    s: input.senderId,
    r: input.recipientId,
    t: input.sentAt,
    k: input.kind,
    b: input.body,
  }
  const p = JSON.stringify(inner)
  const fk = random(FRANKING_KEY_LENGTH)
  const frankingTag = hmac(sha256, fk, utf8(p))
  const payload = pad(utf8(JSON.stringify({ p, fk: b64Encode(fk) })))

  const nonce = random(NONCE_LENGTH)
  const aad = buildAad(
    MESSAGE_VERSION,
    input.id,
    input.matchId,
    input.senderId,
    input.senderBoxKeyId,
    input.recipientBoxKeyId,
  )
  const ciphertext = xchacha20poly1305(key, nonce, aad).encrypt(payload)

  return {
    id: input.id,
    version: MESSAGE_VERSION,
    senderBoxKeyId: input.senderBoxKeyId,
    recipientBoxKeyId: input.recipientBoxKeyId,
    nonce: b64Encode(nonce),
    ciphertext: b64Encode(ciphertext),
    frankingTag: b64Encode(frankingTag),
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new E2eeError('malformed')
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new E2eeError('malformed')
  return value as Record<string, unknown>
}

export function openMessage(envelope: MessageEnvelope, ctx: OpenContext): OpenedMessage {
  if (envelope.version !== MESSAGE_VERSION) throw new E2eeError('unsupported_version')
  if (!isValidBoxKeyId(envelope.senderBoxKeyId) || !isValidBoxKeyId(envelope.recipientBoxKeyId)) {
    throw new E2eeError('malformed')
  }
  assertIdentifier(ctx.recipientId)
  const nonce = b64DecodeLength(envelope.nonce, NONCE_LENGTH)
  // The tag is optional on the wire but we always send it; a missing tag would make the
  // message unreportable, so treat it as tampering.
  const frankingTag = b64DecodeLength(envelope.frankingTag, FRANKING_TAG_LENGTH)
  if (typeof envelope.ciphertext !== 'string') throw new E2eeError('malformed')
  const ciphertext = b64Decode(envelope.ciphertext)

  const key = resolveChatKey(ctx, ctx.matchId)
  const aad = buildAad(
    envelope.version,
    envelope.id,
    ctx.matchId,
    ctx.senderId,
    envelope.senderBoxKeyId,
    envelope.recipientBoxKeyId,
  )

  let padded: Uint8Array
  try {
    padded = xchacha20poly1305(key, nonce, aad).decrypt(ciphertext)
  } catch {
    throw new E2eeError('aead_failed')
  }

  const outer = parseJsonObject(utf8Decode(unpad(padded)))
  if (typeof outer.p !== 'string') throw new E2eeError('malformed')
  const p = outer.p
  const fkBytes = b64DecodeLength(outer.fk, FRANKING_KEY_LENGTH)
  if (!constantTimeEqual(hmac(sha256, fkBytes, utf8(p)), frankingTag)) {
    throw new E2eeError('franking_mismatch')
  }

  const inner = parseJsonObject(p)
  if (inner.v !== MESSAGE_VERSION) throw new E2eeError('unsupported_version')
  if (
    inner.id !== envelope.id ||
    inner.m !== ctx.matchId ||
    inner.s !== ctx.senderId ||
    inner.r !== ctx.recipientId
  ) {
    throw new E2eeError('binding_mismatch')
  }
  if (
    typeof inner.t !== 'number' ||
    !Number.isSafeInteger(inner.t) ||
    (inner.k !== 'text' && inner.k !== 'system') ||
    typeof inner.b !== 'string'
  ) {
    throw new E2eeError('malformed')
  }

  return {
    id: envelope.id,
    matchId: ctx.matchId,
    senderId: ctx.senderId,
    sentAt: inner.t,
    kind: inner.k,
    body: inner.b,
    p,
    fk: b64Encode(fkBytes),
  }
}

/**
 * Which local and peer box key ids an envelope needs, depending on whether I sent it
 * (reading my own history) or received it.
 */
export function keyIdsForOpen(
  envelope: Pick<MessageEnvelope, 'senderBoxKeyId' | 'recipientBoxKeyId'>,
  senderId: string,
  myUserId: string,
): { myBoxKeyId: number; peerBoxKeyId: number } {
  return senderId === myUserId
    ? { myBoxKeyId: envelope.senderBoxKeyId, peerBoxKeyId: envelope.recipientBoxKeyId }
    : { myBoxKeyId: envelope.recipientBoxKeyId, peerBoxKeyId: envelope.senderBoxKeyId }
}
