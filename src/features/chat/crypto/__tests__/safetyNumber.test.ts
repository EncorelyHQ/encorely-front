import { seededRandom } from '../__fixtures__/seededRandom'
import { b64urlDecode } from '../bytes'
import { E2eeError } from '../errors'
import { generateIdentityKeyPair } from '../keyBundle'
import { fingerprint, parseSafetyQr, safetyCode, safetyQrPayload, verifySafetyQr } from '../safetyNumber'

const rng = seededRandom('safety-test')
const a = { userId: '0b5c1f4e-aaaa-4bbb-8ccc-000000000001', identityKey: generateIdentityKeyPair(rng).publicKey }
const b = { userId: '7f2d9e10-aaaa-4bbb-8ccc-000000000002', identityKey: generateIdentityKeyPair(rng).publicKey }

describe('safety code', () => {
  test('is symmetric and has 60 digits in 12 blocks of 5', () => {
    const fromA = safetyCode(a, b)
    const fromB = safetyCode(b, a)
    expect(fromA).toEqual(fromB)
    expect(fromA.blocks).toHaveLength(12)
    fromA.blocks.forEach((block) => expect(block).toMatch(/^\d{5}$/))
    expect(fromA.digits).toMatch(/^\d{60}$/)
    expect(fromA.digits).toBe(fromA.blocks.join(''))
  })

  test('first 6 blocks come from the lower userId', () => {
    const fp = fingerprint(a)
    let value = 0n
    for (let j = 0; j < 5; j++) value = (value << 8n) | BigInt(fp[j])
    expect(safetyCode(b, a).blocks[0]).toBe((value % 100000n).toString().padStart(5, '0'))
  })

  test('changes when either identity key changes', () => {
    const base = safetyCode(a, b).digits
    const a2 = { ...a, identityKey: generateIdentityKeyPair(rng).publicKey }
    const b2 = { ...b, identityKey: generateIdentityKeyPair(rng).publicKey }
    expect(safetyCode(a2, b).digits).not.toBe(base)
    expect(safetyCode(a, b2).digits).not.toBe(base)
  })

  test('deterministic regression vector', () => {
    expect(safetyCode(a, b).digits).toBe('601433217849751782018051894873566311785143047498223342617430')
  })

  test('rejects same user on both sides', () => {
    expect(() => safetyCode(a, { ...a })).toThrow(E2eeError)
  })
})

describe('safety QR', () => {
  test('round-trips and is symmetric', () => {
    const payload = safetyQrPayload(a, b)
    expect(payload).toBe(safetyQrPayload(b, a))
    expect(payload.startsWith('encorely:v1:')).toBe(true)
    expect(b64urlDecode(payload.slice('encorely:v1:'.length))).toHaveLength(64)
    const parsed = parseSafetyQr(payload)
    expect(parsed.lowFingerprint).toEqual(fingerprint(a))
    expect(parsed.highFingerprint).toEqual(fingerprint(b))
    expect(verifySafetyQr(payload, b, a)).toBe(true)
  })

  test('detects a different identity', () => {
    const payload = safetyQrPayload(a, b)
    const b2 = { ...b, identityKey: generateIdentityKeyPair(rng).publicKey }
    expect(verifySafetyQr(payload, a, b2)).toBe(false)
  })

  test('rejects garbage', () => {
    expect(() => parseSafetyQr('encorely:v2:abc')).toThrow(E2eeError)
    expect(() => parseSafetyQr('encorely:v1:AAAA')).toThrow(E2eeError)
    expect(verifySafetyQr('https://evil.example', a, b)).toBe(false)
  })
})
