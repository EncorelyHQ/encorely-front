import { api } from '@/clients/http/client';
import type { NextTrack, SwipeInteractionBody } from '@/clients/encorely/types';

export function getNextTrack(userId: string) {
  return api<NextTrack>('/swipes/next-track', {
    method: 'GET',
    userId,
  });
}

export function postSwipeInteraction(body: SwipeInteractionBody) {
  return api<void>('/swipes/interactions/swipe', {
    method: 'POST',
    body,
  });
}
