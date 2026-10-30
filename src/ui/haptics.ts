import * as Haptics from 'expo-haptics'

// Los haptics nunca deben romper una acción: si el dispositivo no los soporta, se ignoran.
const safe = (run: () => Promise<void>) => {
  run().catch(() => undefined)
}

export const haptics = {
  selection: () => safe(() => Haptics.selectionAsync()),
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
}
