// Endpoints de matches y chat (api/v1/Matches/*, api/v1/Chat/*).
import { apiRequest } from './http';
import type { AcceptMatchResponse, ChatMessage, PendingMatch } from './types';

/** GET /Matches/pending?userId={guid} */
export function getPendingMatches(userId: string): Promise<PendingMatch[]> {
  return apiRequest<PendingMatch[]>('/Matches/pending', { query: { userId } });
}

/** POST /Matches/{matchId}/accept?userId={guid} -> { roomId } */
export function acceptMatch(matchId: string, userId: string): Promise<AcceptMatchResponse> {
  return apiRequest<AcceptMatchResponse>(`/Matches/${encodeURIComponent(matchId)}/accept`, {
    method: 'POST',
    query: { userId },
  });
}

/** GET /Chat/{roomId}/messages?userId={guid} */
export function getChatMessages(roomId: string, userId: string): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/Chat/${encodeURIComponent(roomId)}/messages`, {
    query: { userId },
  });
}

/** POST /Chat/{matchId}/messages?userId={guid} — body es el string del contenido. */
export function sendChatMessage(
  matchId: string,
  userId: string,
  content: string
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/Chat/${encodeURIComponent(matchId)}/messages`, {
    method: 'POST',
    query: { userId },
    body: content,
  });
}
