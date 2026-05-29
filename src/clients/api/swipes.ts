// Endpoints de swipes (api/v1/Swipes/*).
import { apiRequest } from './http';
import { SwipeDirection, type NextTrack } from './types';

/** GET /Swipes/next-track?userId={guid} */
export function getNextTrack(userId: string): Promise<NextTrack> {
  return apiRequest<NextTrack>('/Swipes/next-track', { query: { userId } });
}

/** POST /Swipes/interactions/swipe — registra la interacción (dispara evento Kafka en el backend). */
export function registerSwipe(
  userId: string,
  trackId: string,
  direction: SwipeDirection
): Promise<void> {
  return apiRequest<void>('/Swipes/interactions/swipe', {
    method: 'POST',
    body: { userId, trackId, direction },
  });
}
