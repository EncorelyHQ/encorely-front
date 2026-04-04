/**
 * iOS / Android: almacenamiento en Keychain / Keystore vía expo-secure-store.
 */
import * as SecureStore from 'expo-secure-store';

export async function secureGetItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function secureSetItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function secureDeleteItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

export async function secureDeleteItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k)));
}
