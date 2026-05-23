export type ChatMessage = {
  senderId: string;
  content: string;
  timestamp: string;
};

export type SendChatMessageResponse = {
  id: string;
  content: string;
  timestamp: string;
};
