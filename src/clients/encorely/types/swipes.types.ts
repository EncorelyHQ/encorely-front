import type { SwipeDirection } from './enums';

export type NextTrack = {
  spotifyId: string;
  name: string;
  artist: string;
  previewUrl: string;
};

export type SwipeInteractionBody = {
  userId: string;
  trackId: string;
  direction: SwipeDirection;
};
