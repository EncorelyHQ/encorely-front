import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

import type { KeyValueStore, SecretStore } from './storage'

// THIS_DEVICE_ONLY keeps private keys out of iCloud/device backups; WHEN_UNLOCKED blocks
// reads while the device is locked.
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export const expoSecretStore: SecretStore = {
  getItem: (key) => SecureStore.getItemAsync(key, SECURE_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, SECURE_OPTIONS),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, SECURE_OPTIONS),
}

export const asyncStorageKeyValueStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
  getAllKeys: () => AsyncStorage.getAllKeys(),
}
