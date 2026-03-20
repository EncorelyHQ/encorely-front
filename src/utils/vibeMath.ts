export type VibeVector = {
  energy: number;
  danceability: number;
  valence: number;
  tempo: number;
};

/**
 * Calculates the cosine similarity between two vibe vectors.
 * Returns a value between -1 and 1, where 1 means identical,
 * 0 means orthogonal, and -1 means opposite.
 */
export function cosineSimilarity(a: VibeVector, b: VibeVector): number {
  const dotProduct =
    a.energy * b.energy +
    a.danceability * b.danceability +
    a.valence * b.valence +
    a.tempo * b.tempo;

  const magnitudeA = Math.sqrt(
    a.energy * a.energy +
      a.danceability * a.danceability +
      a.valence * a.valence +
      a.tempo * a.tempo
  );

  const magnitudeB = Math.sqrt(
    b.energy * b.energy +
      b.danceability * b.danceability +
      b.valence * b.valence +
      b.tempo * b.tempo
  );

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // Prevent division by zero
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
