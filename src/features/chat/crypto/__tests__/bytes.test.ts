import {
  b64Decode,
  b64DecodeLength,
  b64Encode,
  b64urlDecode,
  b64urlEncode,
  concat,
  constantTimeEqual,
  u32be,
  utf8,
  utf8Decode,
} from '../bytes'
import { E2eeError } from '../errors'
import { pad, unpad } from '../padding'

const ascii = (s: string) => utf8(s)

describe('base64', () => {
  // RFC 4648 §10 test vectors.
  const vectors: [string, string][] = [
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ]

  test.each(vectors)('encodes and decodes %p', (plain, encoded) => {
    expect(b64Encode(ascii(plain))).toBe(encoded)
    expect(utf8Decode(b64Decode(encoded))).toBe(plain)
  })

  test('base64url uses - and _ and no padding', () => {
    const bytes = Uint8Array.of(0xfb, 0xff, 0xbf, 0xfe)
    expect(b64Encode(bytes)).toBe('+/+//g==')
    expect(b64urlEncode(bytes)).toBe('-_-__g')
    expect(b64urlDecode('-_-__g')).toEqual(bytes)
    expect(b64urlDecode('-_-__g==')).toEqual(bytes)
  })

  test('round-trips all byte values', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    expect(b64Decode(b64Encode(bytes))).toEqual(bytes)
    expect(b64urlDecode(b64urlEncode(bytes))).toEqual(bytes)
  })

  test.each(['Zg', 'Zh==', 'Z===', 'Zm9v!', 'Zm 9v', '-_-__g=='])('rejects invalid standard base64 %p', (text) => {
    expect(() => b64Decode(text)).toThrow(E2eeError)
  })

  test('enforces exact length', () => {
    expect(() => b64DecodeLength(b64Encode(new Uint8Array(31)), 32)).toThrow(E2eeError)
    expect(() => b64DecodeLength(undefined, 32)).toThrow(E2eeError)
    expect(b64DecodeLength(b64Encode(new Uint8Array(32)), 32)).toHaveLength(32)
  })
})

describe('utf8', () => {
  test('round-trips multi-byte text', () => {
    const text = 'hola ñandú 🎧 música — 日本'
    expect(utf8Decode(utf8(text))).toBe(text)
  })

  test.each([
    [[0xc0, 0x80]],
    [[0xe2, 0x82]],
    [[0xed, 0xa0, 0x80]],
    [[0xf5, 0x80, 0x80, 0x80]],
    [[0x80]],
  ])('rejects malformed sequence %p', (bytes) => {
    expect(() => utf8Decode(Uint8Array.from(bytes))).toThrow(E2eeError)
  })
})

describe('helpers', () => {
  test('u32be', () => {
    expect(u32be(0x01020304)).toEqual(Uint8Array.of(1, 2, 3, 4))
    expect(u32be(0xffffffff)).toEqual(Uint8Array.of(255, 255, 255, 255))
    expect(() => u32be(-1)).toThrow(E2eeError)
    expect(() => u32be(2 ** 32)).toThrow(E2eeError)
    expect(() => u32be(1.5)).toThrow(E2eeError)
  })

  test('concat and constantTimeEqual', () => {
    expect(concat(Uint8Array.of(1), Uint8Array.of(2, 3))).toEqual(Uint8Array.of(1, 2, 3))
    expect(constantTimeEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 2))).toBe(true)
    expect(constantTimeEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 3))).toBe(false)
    expect(constantTimeEqual(Uint8Array.of(1), Uint8Array.of(1, 2))).toBe(false)
  })
})

describe('ISO/IEC 7816-4 padding', () => {
  test.each([0, 1, 254, 255, 256, 600])('pads %p bytes to a 256 multiple and back', (length) => {
    const data = Uint8Array.from({ length }, (_, i) => (i % 255) + 1)
    const padded = pad(data)
    expect(padded.length % 256).toBe(0)
    expect(padded.length).toBeGreaterThan(length)
    expect(padded.length - length).toBeLessThanOrEqual(256)
    expect(unpad(padded)).toEqual(data)
  })

  test('255 bytes fit in one block, 256 need two', () => {
    expect(pad(new Uint8Array(255))).toHaveLength(256)
    expect(pad(new Uint8Array(256))).toHaveLength(512)
  })

  test('rejects invalid padding', () => {
    expect(() => unpad(new Uint8Array(0))).toThrow(E2eeError)
    expect(() => unpad(new Uint8Array(256))).toThrow(E2eeError)
    const noMarker = pad(Uint8Array.of(1, 2, 3))
    noMarker[3] = 0x81
    expect(() => unpad(noMarker)).toThrow(E2eeError)
    expect(() => unpad(pad(Uint8Array.of(1)).subarray(0, 255))).toThrow(E2eeError)
    const tooLong = new Uint8Array(512)
    tooLong[0] = 0x80
    expect(() => unpad(tooLong)).toThrow(E2eeError)
  })
})
