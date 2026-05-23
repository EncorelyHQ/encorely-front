import { useCallback, useEffect, useState } from 'react';
import { chatService } from '@/modules/chat/services/chatService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export type ChatMessageView = {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function useChatRoom(roomId: string | undefined) {
  const { userId } = useEncorelyAuth();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !roomId) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await chatService.getMessages(roomId, userId);
      setMessages(
        raw.map((m, i) => ({
          id: `${m.senderId}-${m.timestamp}-${i}`,
          text: m.content,
          isMe: m.senderId === userId,
          time: formatTime(m.timestamp),
        }))
      );
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!userId || !roomId || !content.trim()) return;
      setSending(true);
      setError(null);
      try {
        const sent = await chatService.sendMessage(roomId, userId, content.trim());
        setMessages((prev) => [
          ...prev,
          {
            id: sent.id,
            text: sent.content,
            isMe: true,
            time: formatTime(sent.timestamp),
          },
        ]);
      } catch (e) {
        setError(getApiErrorMessage(e));
        throw e;
      } finally {
        setSending(false);
      }
    },
    [userId, roomId]
  );

  return { messages, loading, error, sending, sendMessage, reload: load };
}
