import { api } from '@/clients/http/client';
import type {
  SendVenueMessageResponse,
  VenueMessage,
  VenueRoom,
} from '@/clients/encorely/types';

export function createVenueRoom(
  eventId: string,
  name: string,
  durationHours = 4
) {
  const params = new URLSearchParams({ name, durationHours: String(durationHours) });
  return api<VenueRoom>(
    `/venue/${encodeURIComponent(eventId)}/rooms?${params.toString()}`,
    { method: 'POST' }
  );
}

export function getVenueMessages(roomId: string) {
  return api<VenueMessage[]>(`/venue/${encodeURIComponent(roomId)}/messages`, {
    method: 'GET',
  });
}

export function sendVenueMessage(roomId: string, userId: string, content: string) {
  return api<SendVenueMessageResponse>(
    `/venue/${encodeURIComponent(roomId)}/messages`,
    {
      method: 'POST',
      userId,
      body: content,
      rawJsonStringBody: true,
    }
  );
}

export function deleteVenueMessage(messageId: string, reason?: string) {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return api<void>(`/venue/messages/${encodeURIComponent(messageId)}${qs}`, {
    method: 'DELETE',
  });
}
