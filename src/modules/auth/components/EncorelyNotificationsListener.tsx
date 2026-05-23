import { useEncorelyNotifications } from '@/modules/auth/hooks/useEncorelyNotifications';

/** Montar dentro de EncorelyAuthProvider para SignalR en background. */
export function EncorelyNotificationsListener() {
  useEncorelyNotifications();
  return null;
}
