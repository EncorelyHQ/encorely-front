/**
 * Haptics: no-op en web (expo-haptics no aplica); en native delega a expo-haptics.
 */
import { Platform } from 'react-native';
import * as ExpoHaptics from 'expo-haptics';

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

export function impactAsync(style: ExpoHaptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return Promise.resolve();
  return ExpoHaptics.impactAsync(style);
}

export function notificationAsync(type: ExpoHaptics.NotificationFeedbackType) {
  if (Platform.OS === 'web') return Promise.resolve();
  return ExpoHaptics.notificationAsync(type);
}
