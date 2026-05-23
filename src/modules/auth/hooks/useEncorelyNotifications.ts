import { useEffect, useRef } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import {
  createNotificationConnection,
  joinUserNotificationGroup,
} from '@/clients/encorely/signalrConnection';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';

type DnaCompletedPayload = { userId: string; message: string };

/**
 * Escucha notificationHub: DnaCompleted y NotifyMatchFound.
 * Refresca perfil al completar ADN; logs de match para integrar toast después.
 */
export function useEncorelyNotifications() {
  const { userId, isAuthenticated, refreshProfile } = useEncorelyAuth();
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let cancelled = false;

    (async () => {
      try {
        const connection = await createNotificationConnection();
        if (cancelled) {
          await connection.stop();
          return;
        }
        connectionRef.current = connection;

        connection.on('DnaCompleted', (...args: unknown[]) => {
          const payload = args[0] as DnaCompletedPayload;
          if (payload?.userId === userId) {
            void refreshProfile();
          }
        });

        connection.on('NotifyMatchFound', (...args: unknown[]) => {
          const [notifiedUserId, matchId, affinity] = args as [string, string, number];
          if (notifiedUserId === userId) {
            console.log('[SignalR] Match found:', matchId, affinity);
            void refreshProfile();
          }
        });

        await joinUserNotificationGroup(connection, userId);
      } catch (e) {
        console.warn('[useEncorelyNotifications] Connection failed:', e);
      }
    })();

    return () => {
      cancelled = true;
      const conn = connectionRef.current;
      connectionRef.current = null;
      if (conn) {
        void conn.stop();
      }
    };
  }, [isAuthenticated, userId, refreshProfile]);
}
