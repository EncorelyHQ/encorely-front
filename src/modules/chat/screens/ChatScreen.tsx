import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/shared/context/AuthContext';
import { getChatMessages, sendChatMessage, formatApiError, type ChatMessage } from '@/clients/api';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const Container = styled.View`
  flex: 1;
  background-color: #181818;
`;

const Header = styled(BlurView)`
  flex-direction: row;
  align-items: center;
  padding: 16px;
  padding-top: 0px;
  border-bottom-width: 1px;
  border-bottom-color: rgba(255,255,255,0.05);
`;

const MessageBubble = styled.View<{ isMe: boolean }>`
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 20px;
  margin-vertical: 4px;
  background-color: ${props => props.isMe ? '#F366FF' : 'rgba(255,255,255,0.1)'};
  align-self: ${props => props.isMe ? 'flex-end' : 'flex-start'};
`;

const MessageText = styled.Text<{ isMe: boolean }>`
  color: #FFF;
  font-size: 15px;
  font-family: 'Inter_500Medium';
`;

const InputContainer = styled(BlurView)`
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
  border-top-width: 1px;
  border-top-color: rgba(255,255,255,0.05);
`;

const StyledInput = styled.TextInput`
  flex: 1;
  background-color: rgba(255,255,255,0.05);
  border-radius: 24px;
  padding-horizontal: 16px;
  padding-vertical: 8px;
  color: #FFF;
  font-family: 'Inter_500Medium';
  margin-right: 12px;
  max-height: 100px;
`;

type Message = {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const roomId = String(id);
  const router = useRouter();
  const { backendUserId } = useAuth();

  // Cabecera: el backend no expone el perfil del otro usuario por sala todavía.
  const match = {
    name: `Match ${roomId.slice(0, 4)}`,
    avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(roomId)}`,
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const mapMessage = useCallback(
    (m: ChatMessage, idx: number): Message => ({
      id: m.id ?? `${m.timestamp}-${idx}`,
      text: m.content,
      isMe: !!backendUserId && m.senderId === backendUserId,
      time: fmtTime(m.timestamp),
    }),
    [backendUserId]
  );

  const loadMessages = useCallback(async () => {
    if (!backendUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getChatMessages(roomId, backendUserId);
      setMessages(data.map(mapMessage));
    } catch (e) {
      setError(formatApiError(e, 'No se pudieron cargar los mensajes'));
    } finally {
      setLoading(false);
    }
  }, [roomId, backendUserId, mapMessage]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (text.length === 0 || !backendUserId) return;

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      text,
      isMe: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await sendChatMessage(roomId, backendUserId, text);
    } catch (e) {
      setError(formatApiError(e, 'No se pudo enviar el mensaje'));
      // Revertir el mensaje optimista si falló el envío.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <Container style={{ paddingTop: Math.max(insets.top, 20) + 10, paddingBottom: insets.bottom }}>
      <LinearGradient colors={['#181818', '#2a1a3a', '#181818']} style={StyleSheet.absoluteFillObject} />
      
      <Header intensity={20}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Image source={{ uri: match.avatar }} style={styles.avatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.matchName}>{match.name}</Text>
        </View>
      </Header>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 20}
      >
        {loading ? (
          <ActivityIndicator color="#F366FF" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MessageBubble isMe={item.isMe}>
                <MessageText isMe={item.isMe}>{item.text}</MessageText>
                <Text style={[styles.timeText, { alignSelf: item.isMe ? 'flex-end' : 'flex-start' }]}>
                  {item.time}
                </Text>
              </MessageBubble>
            )}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 60 }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                  {error ?? 'Aún no hay mensajes. ¡Saluda primero! 👋'}
                </Text>
              </View>
            }
          />
        )}

        <InputContainer intensity={20}>
          <StyledInput 
            placeholder="Escribe un mensaje..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </InputContainer>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  matchName: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'GolosText_700Bold',
  },
  matchScore: {
    color: '#F366FF',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  timeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 4,
  },
  sendBtn: {
    backgroundColor: '#F366FF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
