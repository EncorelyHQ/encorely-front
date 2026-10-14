import { concatBytes as nobleConcat, utf8ToBytes } from '@noble/hashes/utils.js'

import { E2eeError } from './errors'

export type RandomBytes = (length: number) => Uint8Array

export function utf8(text: string): Uint8Array {
  return utf8ToBytes(text)
}

// Hand-rolled strict decoder: TextDecoder is not guaranteed on every Hermes build,
// and we need to reject malformed UTF-8 instead of silently replacing it.
export function utf8Decode(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i]
    let cp: number
    let extra: number
    let min: number
    if (b0 < 0x80) {
      cp = b0
      extra = 0
      min = 0
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      cp = b0 & 0x1f
      extra = 1
      min = 0x80
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      cp = b0 & 0x0f
      extra = 2
      min = 0x800
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      cp = b0 & 0x07
      extra = 3
      min = 0x10000
    } else {
      throw new E2eeError('malformed')
    }
    for (let k = 1; k <= extra; k++) {
      const b = bytes[i + k]
      if (b === undefined || (b & 0xc0) !== 0x80) throw new E2eeError('malformed')
      cp = (cp << 6) | (b & 0x3f)
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
      throw new E2eeError('malformed')
    }
    out += String.fromCodePoint(cp)
    i += extra + 1
  }
  return out
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  return nobleConcat(...parts)
}

export function u8(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) throw new E2eeError('invalid_input')
  return Uint8Array.of(value)
}

export function u32be(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new E2eeError('invalid_input')
  }
  return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function buildLookup(alphabet: string): Int16Array {
  const table = new Int16Array(128).fill(-1)
  for (let i = 0; i < alphabet.length; i++) table[alphabet.charCodeAt(i)] = i
  return table
}

const B64_LOOKUP = buildLookup(B64_ALPHABET)
const B64URL_LOOKUP = buildLookup(B64URL_ALPHABET)

function encodeWith(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + alphabet[n & 63]
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i] << 16
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + (pad ? '==' : '')
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + (pad ? '=' : '')
  }
  return out
}

function decodeWith(text: string, lookup: Int16Array, requirePadding: boolean): Uint8Array {
  let body = text
  if (requirePadding) {
    if (text.length % 4 !== 0) throw new E2eeError('malformed')
  }
  if (body.endsWith('==')) body = body.slice(0, -2)
  else if (body.endsWith('=')) body = body.slice(0, -1)
  if (body.length % 4 === 1) throw new E2eeError('malformed')

  const outLength = Math.floor((body.length * 3) / 4)
  const out = new Uint8Array(outLength)
  let buffer = 0
  let bits = 0
  let o = 0
  for (let i = 0; i < body.length; i++) {
    const code = body.charCodeAt(i)
    const value = code < 128 ? lookup[code] : -1
    if (value < 0) throw new E2eeError('malformed')
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[o++] = (buffer >> bits) & 0xff
    }
  }
  // Non-zero leftover bits mean a non-canonical encoding; reject so each byte string has one form.
  if ((buffer & ((1 << bits) - 1)) !== 0) throw new E2eeError('malformed')
  return out
}

export function b64Encode(bytes: Uint8Array): string {
  return encodeWith(bytes, B64_ALPHABET, true)
}

export function b64Decode(text: string): Uint8Array {
  return decodeWith(text, B64_LOOKUP, true)
}

export function b64urlEncode(bytes: Uint8Array): string {
  return encodeWith(bytes, B64URL_ALPHABET, false)
}

export function b64urlDecode(text: string): Uint8Array {
  return decodeWith(text, B64URL_LOOKUP, false)
}

/** Decodes standard base64 and enforces an exact byte length. */
export function b64DecodeLength(text: unknown, length: number): Uint8Array {
  if (typeof text !== 'string') throw new E2eeError('malformed')
  const bytes = b64Decode(text)
  if (bytes.length !== length) throw new E2eeError('malformed')
  return bytes
}

// UUID canónico → 16 bytes en orden RFC 4122 (big-endian), como lo serializa el back para el franking.
export function uuidBytes(uuid: string): Uint8Array {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid)) {
    throw new E2eeError('invalid_input')
  }
  const hex = uuid.replace(/-/g, '')
  const out = new Uint8Array(16)
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}
