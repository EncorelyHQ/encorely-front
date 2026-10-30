import { getRandomValues } from 'expo-crypto'

type GetRandomValues = <T extends ArrayBufferView | null>(array: T) => T

/**
 * @noble reads `globalThis.crypto.getRandomValues`, which Hermes does not provide.
 * Call once at app start, before any chat crypto runs.
 */
export function installCryptoPolyfill(): void {
  const scope = globalThis as { crypto?: { getRandomValues?: GetRandomValues } }
  if (typeof scope.crypto?.getRandomValues === 'function') return

  const polyfill = ((array: ArrayBufferView | null) => {
    if (array === null) return array
    // expo-crypto only accepts integer typed arrays; view any buffer as bytes so the
    // whole region gets filled regardless of the caller's element type.
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
    getRandomValues(bytes)
    return array
  }) as GetRandomValues

  if (scope.crypto) {
    Object.defineProperty(scope.crypto, 'getRandomValues', { value: polyfill, configurable: true })
  } else {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: polyfill },
      configurable: true,
    })
  }
}
