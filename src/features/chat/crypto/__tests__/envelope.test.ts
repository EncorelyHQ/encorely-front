import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

import { seededRandom } from '../__fixtures__/seededRandom'
import { b64Decode, b64Encode, utf8 } from '../bytes'
import { buildAad, keyIdsForOpen, openMessage, sealMessage, type MessageEnvelope, type SealInput } from '../envelope'
import { E2eeError, isE2eeError, type E2eeErrorCode } from '../errors'
import { generateBoxKeyPair } from '../keyBundle'
import { deriveChatKey } from '../pairKey'

const rng = seededRandom('envelope-test')
const alice = { userId: 'user-a', box: generateBoxKeyPair(rng), keyId: 3 }
const bob = { userId: 'user-b', box: generateBoxKeyPair(rng), keyId: 7 }
const MATCH = 'match-1'

function input(overrides: Partial<SealInput> = {}): SealInput {
  return {
    id: 'msg-1',
    matchId: MATCH,
    senderId: alice.userId,
    recipientId: bob.userId,
    sentAt: 1_760_000_000_000,
    kind: 'text',
    body: 'hola, ¿vamos al concierto? 🎸',
    senderBoxKeyId: alice.keyId,
    recipientBoxKeyId: bob.keyId,
    mySecret: alice.box.secretKey,
    peerBoxPublic: bob.box.publicKey,
    ...overrides,
  } as SealInput
}

const bobCtx = {
  matchId: MATCH,
  senderId: alice.userId,
  recipientId: bob.userId,
  mySecret: bob.box.secretKey,
  peerBoxPublic: alice.box.publicKey,
}

function expectCode(fn: () => unknown, code: E2eeErrorCode) {
  try {
    fn()
  } catch (error) {
    expect(isE2eeError(error, code)).toBe(true)
    // Errors must never leak content.
    expect((error as Error).message).not.toContain('hola')
    return
  }
  throw new Error(`expected E2eeError ${code}`)
}

function flipBit(b64: string, byteIndex = 0): string {
  const bytes = b64Decode(b64)
  bytes[byteIndex] ^= 0x01
  return b64Encode(bytes)
}

describe('sealMessage / openMessage', () => {
  test('B opens what A sealed with its own keys', () => {
    const envelope = sealMessage(input())
    const opened = openMessage(envelope, bobCtx)
    expect(opened).toMatchObject({
      id: 'msg-1',
      matchId: MATCH,
      senderId: alice.userId,
      sentAt: 1_760_000_000_000,
      kind: 'text',
      body: 'hola, ¿vamos al concierto? 🎸',
    })
    expect(JSON.parse(opened.p)).toEqual({
      v: 1,
      id: 'msg-1',
      m: MATCH,
      s: alice.userId,
      r: bob.userId,
      t: 1_760_000_000_000,
      k: 'text',
      b: 'hola, ¿vamos al concierto? 🎸',
    })
    expect(b64Decode(opened.fk)).toHaveLength(32)
  })

  test('A can reopen its own sent message (history)', () => {
    const envelope = sealMessage(input())
    const ids = keyIdsForOpen(envelope, alice.userId, alice.userId)
    expect(ids).toEqual({ myBoxKeyId: alice.keyId, peerBoxKeyId: bob.keyId })
    expect(keyIdsForOpen(envelope, alice.userId, bob.userId)).toEqual({
      myBoxKeyId: bob.keyId,
      peerBoxKeyId: alice.keyId,
    })
    const opened = openMessage(envelope, { ...bobCtx, mySecret: alice.box.secretKey, peerBoxPublic: bob.box.publicKey })
    expect(opened.body).toBe('hola, ¿vamos al concierto? 🎸')
  })

  test('works with a pre-derived chat key', () => {
    const chatKey = deriveChatKey(bob.box.secretKey, alice.box.publicKey, MATCH)
    expect(chatKey).toEqual(deriveChatKey(alice.box.secretKey, bob.box.publicKey, MATCH))
    const envelope = sealMessage({ ...input(), mySecret: undefined, peerBoxPublic: undefined, chatKey } as never)
    expect(openMessage(envelope, { matchId: MATCH, senderId: alice.userId, recipientId: bob.userId, chatKey }).body).toBe(
      'hola, ¿vamos al concierto? 🎸',
    )
  })

  test('envelope has the wire shape and padded ciphertext', () => {
    const envelope = sealMessage(input())
    expect(Object.keys(envelope).sort()).toEqual(
      ['ciphertext', 'frankingTag', 'id', 'nonce', 'recipientBoxKeyId', 'senderBoxKeyId', 'version'].sort(),
    )
    expect(envelope.version).toBe(1)
    expect(b64Decode(envelope.nonce)).toHaveLength(24)
    expect(b64Decode(envelope.frankingTag!)).toHaveLength(32)
    // 256-byte buckets + 16-byte Poly1305 tag.
    expect((b64Decode(envelope.ciphertext).length - 16) % 256).toBe(0)
  })

  test('nonce is fresh per message', () => {
    const a = sealMessage(input())
    const b = sealMessage(input())
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  test('deterministic regression vector with injected randomness', () => {
    const a = sealMessage(input(), { randomBytes: seededRandom('vector') })
    const b = sealMessage(input(), { randomBytes: seededRandom('vector') })
    expect(a).toEqual(b)
    const digest = bytesToHex(sha256(utf8(JSON.stringify(a))))
    expect(digest).toBe('be2ce5ffadd3e1b2fd082112487f3e93ad135843a9fefbb57132b57da8b7142b')
  })

  test('wrong key fails', () => {
    const envelope = sealMessage(input())
    const eve = generateBoxKeyPair(rng)
    expectCode(() => openMessage(envelope, { ...bobCtx, mySecret: eve.secretKey }), 'aead_failed')
  })

  test.each(['ciphertext', 'nonce'] as const)('a flipped bit in %s fails', (field) => {
    const envelope = sealMessage(input())
    expectCode(() => openMessage({ ...envelope, [field]: flipBit(envelope[field], 5) }, bobCtx), 'aead_failed')
  })

  test('tampered AAD fields fail', () => {
    const envelope = sealMessage(input())
    expectCode(() => openMessage({ ...envelope, id: 'msg-2' }, bobCtx), 'aead_failed')
    expectCode(() => openMessage({ ...envelope, senderBoxKeyId: alice.keyId + 1 }, bobCtx), 'aead_failed')
    expectCode(() => openMessage({ ...envelope, recipientBoxKeyId: bob.keyId + 1 }, bobCtx), 'aead_failed')
  })

  test('moving the envelope to another match fails', () => {
    const envelope = sealMessage(input())
    // Same raw keys, other match: both the derived key and the AAD differ.
    expectCode(() => openMessage(envelope, { ...bobCtx, matchId: 'match-2' }), 'aead_failed')
    // Even with the original match's key, the AAD binds the matchId.
    const chatKey = deriveChatKey(bob.box.secretKey, alice.box.publicKey, MATCH)
    expectCode(
      () => openMessage(envelope, { matchId: 'match-2', senderId: alice.userId, recipientId: bob.userId, chatKey }),
      'aead_failed',
    )
  })

  test('changing senderId fails', () => {
    const envelope = sealMessage(input())
    expectCode(() => openMessage(envelope, { ...bobCtx, senderId: bob.userId }), 'aead_failed')
  })

  test('inner recipient must match the context', () => {
    const envelope = sealMessage(input())
    expectCode(() => openMessage(envelope, { ...bobCtx, recipientId: 'user-c' }), 'binding_mismatch')
  })

  test('tampered or missing frankingTag fails', () => {
    const envelope = sealMessage(input())
    expectCode(() => openMessage({ ...envelope, frankingTag: flipBit(envelope.frankingTag!) }, bobCtx), 'franking_mismatch')
    const { frankingTag: _omit, ...withoutTag } = envelope
    expectCode(() => openMessage(withoutTag as MessageEnvelope, bobCtx), 'malformed')
  })

  test('unsupported version fails', () => {
    const envelope = sealMessage(input())
    expectCode(() => openMessage({ ...envelope, version: 2 }, bobCtx), 'unsupported_version')
  })

  test('franking evidence verifies independently (what the server does on report)', () => {
    const envelope = sealMessage(input())
    const opened = openMessage(envelope, bobCtx)
    const tag = hmac(sha256, b64Decode(opened.fk), utf8(opened.p))
    expect(b64Encode(tag)).toBe(envelope.frankingTag)
  })

  test('rejects identifiers containing NUL', () => {
    expect(() => sealMessage(input({ id: 'a\0b' }))).toThrow(E2eeError)
    expect(() => buildAad(1, 'a', 'b\0', 'c', 1, 1)).toThrow(E2eeError)
  })

  test('AAD layout', () => {
    const aad = buildAad(1, 'i', 'm', 's', 0x01020304, 5)
    expect(Array.from(aad)).toEqual([
      ...utf8('ENCORELY-MSG-v1'),
      1,
      ...utf8('i'),
      0,
      ...utf8('m'),
      0,
      ...utf8('s'),
      0,
      1, 2, 3, 4,
      0, 0, 0, 5,
    ])
  })

  test('low-order peer key is rejected', () => {
    expectCode(() => deriveChatKey(alice.box.secretKey, new Uint8Array(32), MATCH), 'invalid_key')
  })
})
