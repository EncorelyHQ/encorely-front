import { EncorelyMatchRequest } from '../types/match';

export function useMatches() {
  const sendMatchRequest = async (toUserId: string): Promise<boolean> => {
    console.log(`[useMatches] Sending match request to: ${toUserId}`);
    // Dummy implementation. Will be replaced by backend API call.
    return true;
  };

  const respondToMatch = async (matchId: string, status: 'accepted' | 'rejected'): Promise<boolean> => {
    console.log(`[useMatches] Responding to match ${matchId} with status: ${status}`);
    // Dummy implementation. Will be replaced by backend API call.
    return true;
  };

  return {
    sendMatchRequest,
    respondToMatch,
  };
}
