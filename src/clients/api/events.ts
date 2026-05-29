// Endpoints de eventos y radar (api/v1/Events/*).
import { apiRequest } from './http';
import { ConcertMood, type EventItem, type RadarMatch } from './types';

/** GET /Events/feed — eventos cercanos (lista pública). */
export function getEventsFeed(): Promise<EventItem[]> {
  return apiRequest<EventItem[]>('/Events/feed');
}

/**
 * GET /Events/{eventId}/matches — radar de compatibilidad para un evento.
 * Requiere swipeCount >= 25 (el backend devuelve 403 si no).
 */
export function getEventMatches(
  eventId: string,
  userId: string,
  targetMood?: ConcertMood
): Promise<RadarMatch[]> {
  return apiRequest<RadarMatch[]>(`/Events/${encodeURIComponent(eventId)}/matches`, {
    query: { userId, targetMood: targetMood ?? undefined },
  });
}
