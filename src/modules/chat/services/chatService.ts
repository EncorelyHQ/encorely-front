import { getChatMessages, sendChatMessage } from '@/clients/encorely/chatClient';

export const chatService = {
  getMessages: (roomId: string, userId: string) => getChatMessages(roomId, userId),
  sendMessage: (matchId: string, userId: string, content: string) =>
    sendChatMessage(matchId, userId, content),
};
