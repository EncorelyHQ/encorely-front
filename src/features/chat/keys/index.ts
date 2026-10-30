import { createDeviceKeys } from './deviceKeys'
import { asyncStorageKeyValueStore, expoSecretStore } from './expoStores'
import { createPeerKeyStore } from './peerKeys'

export {
  createDeviceKeys,
  type CurrentBoxKey,
  type DeviceKeys,
  type DeviceKeysDeps,
  type EnsureOptions,
  type EnsureResult,
  type KeyStatus,
} from './deviceKeys'
export {
  acceptChange,
  createPeerKeyStore,
  evaluatePeerBundle,
  markVerified,
  trustHistoricalBoxKey,
  type PeerEvaluation,
  type PeerKeyEvent,
  type PeerKeyStore,
  type PeerTrustState,
  type PinnedPeer,
} from './peerKeys'
export { decodeKeyMaterial, type KeyMaterial } from './material'
export { expoSecretStore } from './expoStores'
export {
  createMemoryKeyValueStore,
  createMemorySecretStore,
  type KeyValueStore,
  type SecretStore,
} from './storage'

/** App-wide instances backed by expo-secure-store and AsyncStorage. */
export const deviceKeys = createDeviceKeys({ secure: expoSecretStore, kv: asyncStorageKeyValueStore })
export const peerKeys = createPeerKeyStore(asyncStorageKeyValueStore)
