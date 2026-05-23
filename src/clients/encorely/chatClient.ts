import { api } from '@/clients/http/client';
import type { ChatMessage, SendChatMessageResponse } from '@/clients/encorely/types';

export function getChatMessages(roomId: string, userId: string) {
  return api<ChatMessage[]>(`/chat/${encodeURIComponent(roomId)}/messages`, {
    method: 'GET',
    userId,
  });
}

export function sendChatMessage(matchId: string, userId: string, content: string) {
  return api<SendChatMessageResponse>(
    `/chat/${encodeURIComponent(matchId)}/messages`,
    {
      method: 'POST',
      userId,
      body: content,
      rawJsonStringBody: true,
    }
  );
}
