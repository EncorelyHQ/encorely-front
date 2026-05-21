import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

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

const DUMMY_MATCHES: Record<string, any> = {
  u1: { name: 'Valeria', avatar: 'https://i.pravatar.cc/150?u=valeria', score: 95 },
  u2: { name: 'Carlos', avatar: 'https://i.pravatar.cc/150?u=carlos', score: 92 },
  u3: { name: 'Andrea', avatar: 'https://i.pravatar.cc/150?u=andrea', score: 88 },
  u4: { name: 'Diego', avatar: 'https://i.pravatar.cc/150?u=diego', score: 81 },
  u5: { name: 'Lucía', avatar: 'https://i.pravatar.cc/150?u=lucia', score: 75 },
};

type Message = {
  id: string;
  text: string;
  isMe: boolean;
  time: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const match = DUMMY_MATCHES[id as string] || { name: 'Usuario', avatar: 'https://i.pravatar.cc/150?u=anon', score: 0 };
  
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: '¡Hola! Vi que tenemos un vibe muy parecido 🎵', isMe: false, time: '10:00 AM' },
    { id: '2', text: '¡Sii! Me encantó tu top de Indie Rock. ¿Fuiste al concierto de ayer?', isMe: true, time: '10:02 AM' },
    { id: '3', text: '¡No pude! Estaba trabajando, pero dicen que estuvo increíble. ¿Qué tal estuvo?', isMe: false, time: '10:05 AM' },
  ]);
  
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (inputText.trim().length === 0) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isMe: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
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
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

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
