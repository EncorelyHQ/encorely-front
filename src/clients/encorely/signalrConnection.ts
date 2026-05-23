import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr';
import { getApiBaseUrl } from '@/config/api';
import { getEncorelyAccessToken } from '@/clients/encorely/lib/session';
import { SIGNALR_HUBS } from '@/clients/encorely/signalr';

export async function createNotificationConnection(): Promise<HubConnection> {
  const token = await getEncorelyAccessToken();
  const url = `${getApiBaseUrl()}${SIGNALR_HUBS.notifications}`;

  return new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => token ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Warning)
    .build();
}

export async function joinUserNotificationGroup(
  connection: HubConnection,
  userId: string
): Promise<void> {
  if (connection.state !== 'Connected') {
    await connection.start();
  }
  await connection.invoke('JoinUserGroup', userId);
}

/** Venue hub — usar cuando exista pantalla de sala en vivo. */
export async function createVenueConnection(): Promise<HubConnection> {
  const token = await getEncorelyAccessToken();
  const url = `${getApiBaseUrl()}${SIGNALR_HUBS.venue}`;

  return new HubConnectionBuilder()
    .withUrl(url, {
      accessTokenFactory: () => token ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Warning)
    .build();
}

export async function joinVenueRoom(
  connection: HubConnection,
  roomId: string
): Promise<void> {
  if (connection.state !== 'Connected') {
    await connection.start();
  }
  await connection.invoke('JoinVenueRoom', roomId);
}
