import type { PendingMatch, RadarMatch } from '@/clients/encorely/types';

export type MatchCardView = {
  id: string;
  name: string;
  compatibilityScore: number;
  status: 'pending' | 'accepted';
  avatar?: string;
};

export function mapPendingMatchToCard(match: PendingMatch): MatchCardView {
  return {
    id: match.matchId,
    name: match.displayName,
    compatibilityScore: match.compatibility,
    status: 'pending',
  };
}

export function mapRadarMatchToCard(match: RadarMatch): MatchCardView {
  return {
    id: match.id,
    name: match.displayName,
    compatibilityScore: match.affinity,
    status: 'pending',
  };
}
