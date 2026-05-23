import { api } from '@/clients/http/client';
import type { AcceptMatchResponse, PendingMatch } from '@/clients/encorely/types';

export function getPendingMatches(userId: string) {
  return api<PendingMatch[]>('/matches/pending', {
    method: 'GET',
    userId,
  });
}

export function acceptMatch(matchId: string, userId: string) {
  return api<AcceptMatchResponse>(`/matches/${encodeURIComponent(matchId)}/accept`, {
    method: 'POST',
    userId,
  });
}
