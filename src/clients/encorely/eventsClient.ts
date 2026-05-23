import { api } from '@/clients/http/client';
import type { ConcertMood } from '@/clients/encorely/types';
import type { EventFeedItem, RadarMatch } from '@/clients/encorely/types';

export function getEventsFeed() {
  return api<EventFeedItem[]>('/events/feed', {
    method: 'GET',
  });
}

export function getEventMatches(
  eventId: string,
  userId: string,
  targetMood?: ConcertMood
) {
  let path = `/events/${encodeURIComponent(eventId)}/matches`;
  if (targetMood !== undefined) {
    path += `?targetMood=${targetMood}`;
  }
  return api<RadarMatch[]>(path, {
    method: 'GET',
    userId,
  });
}
