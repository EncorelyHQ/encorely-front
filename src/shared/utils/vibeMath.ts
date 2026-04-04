import type { VibeVector } from '../types/vibe';

export function cosineSimilarity(a: VibeVector, b: VibeVector): number {
  const va = [a.energy, a.danceability, a.valence, a.tempo];
  const vb = [b.energy, b.danceability, b.valence, b.tempo];

  const dot = va.reduce((acc, val, i) => acc + val * vb[i], 0);
  const magA = Math.sqrt(va.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vb.reduce((acc, val) => acc + val * val, 0));

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}
