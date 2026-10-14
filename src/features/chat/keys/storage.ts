/** Secret storage (Keychain / Keystore). Keys must match [A-Za-z0-9._-]. */
export interface SecretStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  deleteItem(key: string): Promise<void>
}

/** Non-secret, app-sandboxed storage that is wiped on uninstall (AsyncStorage). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  /** Optional: every key in the store, to clean up entries written before an index existed. */
  getAllKeys?(): Promise<readonly string[]>
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/

export function assertSafeKeySegment(segment: string): void {
  if (!SAFE_SEGMENT.test(segment)) throw new Error('Unsupported id for secure storage key')
}

export function createMemorySecretStore(): SecretStore & { dump(): Map<string, string> } {
  const map = new Map<string, string>()
  return {
    async getItem(key) {
      assertSafeKeySegment(key)
      return map.get(key) ?? null
    },
    async setItem(key, value) {
      assertSafeKeySegment(key)
      map.set(key, value)
    },
    async deleteItem(key) {
      map.delete(key)
    },
    dump: () => map,
  }
}

export function createMemoryKeyValueStore(): KeyValueStore & { dump(): Map<string, string> } {
  const map = new Map<string, string>()
  return {
    async getItem(key) {
      return map.get(key) ?? null
    },
    async setItem(key, value) {
      map.set(key, value)
    },
    async removeItem(key) {
      map.delete(key)
    },
    async getAllKeys() {
      return [...map.keys()]
    },
    dump: () => map,
  }
}
