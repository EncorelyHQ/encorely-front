/**
 * Web: expo-secure-store no expone API nativa (stub vacío).
 * Persistencia con AsyncStorage; suficiente para dev en navegador.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEB_PREFIX = 'encorely_ss:';

export async function secureGetItem(key: string): Promise<string | null> {
  return AsyncStorage.getItem(WEB_PREFIX + key);
}

export async function secureSetItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(WEB_PREFIX + key, value);
}

export async function secureDeleteItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(WEB_PREFIX + key);
}

export async function secureDeleteItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => secureDeleteItem(k)));
}
