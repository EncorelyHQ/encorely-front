import { sha256 } from '@noble/hashes/sha2.js'

import { b64urlDecode, b64urlEncode, concat, constantTimeEqual, utf8 } from './bytes'
import { E2eeError } from './errors'

const FP_CONTEXT = utf8('ENCORELY-FP-v1')
const QR_PREFIX = 'encorely:v1:'
const BLOCKS_PER_USER = 6
const BLOCK_BYTES = 5
const FP_LENGTH = 32

export interface SafetyParty {
  userId: string
  /** Raw Ed25519 identity public key (32 bytes). */
  identityKey: Uint8Array
}

export interface SafetyCode {
  /** 12 blocks of 5 digits: lower userId first, then higher. */
  blocks: string[]
  /** The same 60 digits without separators. */
  digits: string
}

export function fingerprint(party: SafetyParty): Uint8Array {
  if (!party.userId || party.userId.includes('\0') || party.identityKey.length !== 32) {
    throw new E2eeError('invalid_input')
  }
  return sha256(concat(FP_CONTEXT, utf8(party.userId), Uint8Array.of(0), party.identityKey))
}

// Plain `<` string order (UTF-16 code units) keeps the result identical on both devices.
function orderParties(a: SafetyParty, b: SafetyParty): [SafetyParty, SafetyParty] {
  if (a.userId === b.userId) throw new E2eeError('invalid_input')
  return a.userId < b.userId ? [a, b] : [b, a]
}

function fingerprintBlocks(fp: Uint8Array): string[] {
  const blocks: string[] = []
  for (let i = 0; i < BLOCKS_PER_USER; i++) {
    // 5 bytes = 40 bits, beyond safe bitwise ops but well within float precision; BigInt
    // keeps it obviously exact.
    let value = 0n
    for (let j = 0; j < BLOCK_BYTES; j++) value = (value << 8n) | BigInt(fp[i * BLOCK_BYTES + j])
    blocks.push((value % 100000n).toString().padStart(5, '0'))
  }
  return blocks
}

export function safetyCode(a: SafetyParty, b: SafetyParty): SafetyCode {
  const [low, high] = orderParties(a, b)
  const blocks = [...fingerprintBlocks(fingerprint(low)), ...fingerprintBlocks(fingerprint(high))]
  return { blocks, digits: blocks.join('') }
}

export function safetyQrPayload(a: SafetyParty, b: SafetyParty): string {
  const [low, high] = orderParties(a, b)
  return QR_PREFIX + b64urlEncode(concat(fingerprint(low), fingerprint(high)))
}

export interface ParsedSafetyQr {
  lowFingerprint: Uint8Array
  highFingerprint: Uint8Array
}

export function parseSafetyQr(payload: string): ParsedSafetyQr {
  if (typeof payload !== 'string' || !payload.startsWith(QR_PREFIX)) throw new E2eeError('malformed')
  const raw = b64urlDecode(payload.slice(QR_PREFIX.length))
  if (raw.length !== FP_LENGTH * 2) throw new E2eeError('malformed')
  return { lowFingerprint: raw.slice(0, FP_LENGTH), highFingerprint: raw.slice(FP_LENGTH) }
}

/** True when a scanned QR matches what this device computes for (me, peer). */
export function verifySafetyQr(payload: string, me: SafetyParty, peer: SafetyParty): boolean {
  let parsed: ParsedSafetyQr
  try {
    parsed = parseSafetyQr(payload)
  } catch {
    return false
  }
  const [low, high] = orderParties(me, peer)
  const expected = concat(fingerprint(low), fingerprint(high))
  return constantTimeEqual(concat(parsed.lowFingerprint, parsed.highFingerprint), expected)
}
