import { acceptMatch, getPendingMatches } from '@/clients/encorely/matchesClient';

export const matchesService = {
  getPending: (userId: string) => getPendingMatches(userId),
  accept: (matchId: string, userId: string) => acceptMatch(matchId, userId),
};
