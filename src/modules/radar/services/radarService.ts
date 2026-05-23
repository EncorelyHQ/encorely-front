import { getEventMatches, getEventsFeed } from '@/clients/encorely/eventsClient';
import type { ConcertMood } from '@/clients/encorely/types';

export const radarService = {
  getEventsFeed: () => getEventsFeed(),
  getEventMatches: (eventId: string, userId: string, targetMood?: ConcertMood) =>
    getEventMatches(eventId, userId, targetMood),
};
