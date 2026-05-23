import { ConcertMood } from '@/clients/encorely/types';

const MOOD_LABELS: Record<ConcertMood, string> = {
  [ConcertMood.Moshpit]: 'Moshpit',
  [ConcertMood.Chill]: 'Chill',
  [ConcertMood.VIP]: 'VIP',
};

export function concertMoodToLabel(mood: ConcertMood): string {
  return MOOD_LABELS[mood] ?? 'Chill';
}

export function profileMoodToConcertMood(mood: string): ConcertMood {
  const normalized = mood.trim().toLowerCase();
  if (normalized === 'moshpit') return ConcertMood.Moshpit;
  if (normalized === 'vip') return ConcertMood.VIP;
  return ConcertMood.Chill;
}
