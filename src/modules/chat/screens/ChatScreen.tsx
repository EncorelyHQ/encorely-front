import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useChatRoom } from '@/modules/chat/hooks/useChatRoom';

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
  border-bottom-color: rgba(255, 255, 255, 0.05);
`;

const MessageBubble = styled.View<{ isMe: boolean }>`
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 20px;
  margin-vertical: 4px;
  background-color: ${(props: { isMe: boolean }) =>
    props.isMe ? '#F366FF' : 'rgba(255,255,255,0.1)'};
  align-self: ${(props: { isMe: boolean }) => (props.isMe ? 'flex-end' : 'flex-start')};
`;

const MessageText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-family: 'Inter_500Medium';
`;

const InputContainer = styled(BlurView)`
  flex-direction: row;
  align-items: center;
  padding: 12px 16px;
  border-top-width: 1px;
  border-top-color: rgba(255, 255, 255, 0.05);
`;

const StyledInput = styled.TextInput`
  flex: 1;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding-horizontal: 16px;
  padding-vertical: 8px;
  color: #fff;
  font-family: 'Inter_500Medium';
  margin-right: 12px;
  max-height: 100px;
`;

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const roomId = typeof id === 'string' ? id : id?.[0];
  const matchName =
    typeof name === 'string' ? name : Array.isArray(name) ? name[0] : 'Chat';

  const { messages, loading, error, sending, sendMessage, reload } = useChatRoom(roomId);
  const [inputText, setInputText] = React.useState('');
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    React.useCallback(() => {
      void reload();
    }, [reload])
  );

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    try {
      await sendMessage(text);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInputText(text);
    }
  };

  return (
    <Container>
      <LinearGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Header intensity={20}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.matchName}>{matchName}</Text>
          </View>
        </Header>

        {loading ? (
          <ActivityIndicator color="#F366FF" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={{ padding: 20 }}>
            <Text style={{ color: '#ff6b6b', fontFamily: 'Inter_500Medium' }}>{error}</Text>
            <TouchableOpacity onPress={() => void reload()} style={{ marginTop: 12 }}>
              <Text style={{ color: '#F366FF' }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            renderItem={({ item }) => (
              <MessageBubble isMe={item.isMe}>
                <MessageText>{item.text}</MessageText>
                <Text style={styles.timeText}>{item.time}</Text>
              </MessageBubble>
            )}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <InputContainer intensity={20}>
            <StyledInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
            />
            <TouchableOpacity onPress={() => void handleSend()} disabled={sending}>
              {sending ? (
                <ActivityIndicator size="small" color="#F366FF" />
              ) : (
                <Ionicons name="send" size={24} color="#F366FF" />
              )}
            </TouchableOpacity>
          </InputContainer>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Container>
  );
}

const styles = StyleSheet.create({
  matchName: { color: '#FFF', fontSize: 18, fontFamily: 'GolosText_700Bold' },
  timeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
  },
});
