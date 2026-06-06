export function useMatches() {
  const sendMatchRequest = async (toUserId: string): Promise<boolean> => {
    return true;
  };

  const respondToMatch = async (
    matchId: string,
    status: 'accepted' | 'rejected'
  ): Promise<boolean> => {
    return true;
  };

  return {
    sendMatchRequest,
    respondToMatch,
  };
}
