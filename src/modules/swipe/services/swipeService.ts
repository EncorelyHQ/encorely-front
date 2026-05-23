import { getNextTrack, postSwipeInteraction } from '@/clients/encorely/swipesClient';
import type { SwipeInteractionBody } from '@/clients/encorely/types';

export const swipeService = {
  getNextTrack: (userId: string) => getNextTrack(userId),
  recordSwipe: (body: SwipeInteractionBody) => postSwipeInteraction(body),
};
