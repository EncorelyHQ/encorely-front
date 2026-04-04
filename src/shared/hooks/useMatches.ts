export function useMatches() {
  const sendMatchRequest = async (toUserId: string): Promise<boolean> => {
    console.log(`[useMatches] Sending match request to: ${toUserId}`);
    return true;
  };

  const respondToMatch = async (
    matchId: string,
    status: 'accepted' | 'rejected'
  ): Promise<boolean> => {
    console.log(`[useMatches] Responding to match ${matchId} with status: ${status}`);
    return true;
  };

  return {
    sendMatchRequest,
    respondToMatch,
  };
}
