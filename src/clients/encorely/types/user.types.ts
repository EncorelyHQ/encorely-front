import type { ConcertMood } from './enums';

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  provider: string;
  swipeCount: number;
  mood: string;
};

export type UpdateUserSettingsBody = {
  userId: string;
  mood: ConcertMood;
};
