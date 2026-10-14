import { installCryptoPolyfill } from '../random'

// babel-jest hoists jest.mock above the import.
jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((array: Uint8Array) => {
    array.fill(7)
    return array
  }),
}))

describe('installCryptoPolyfill', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, 'crypto', original)
  })

  test('keeps an existing implementation', () => {
    const existing = globalThis.crypto.getRandomValues
    installCryptoPolyfill()
    expect(globalThis.crypto.getRandomValues).toBe(existing)
  })

  test('installs expo-crypto when crypto is missing (Hermes)', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    installCryptoPolyfill()
    const words = new Uint32Array(2)
    globalThis.crypto.getRandomValues(words)
    expect(Array.from(new Uint8Array(words.buffer))).toEqual(new Array(8).fill(7))
  })
})
