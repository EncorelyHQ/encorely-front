import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { VibeVector } from '@/shared/types/vibe';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type MatchUser = {
  id: string;
  name: string;
  avatar: string;
  compatibilityScore: number;
  topGenres: string[];
  vibeVector: VibeVector;
  status: 'pending' | 'accepted';
  hasChatted: boolean;
};

const initialMatches: MatchUser[] = [
  {
    id: 'u1',
    name: 'Valeria',
    avatar: 'https://i.pravatar.cc/150?u=valeria',
    compatibilityScore: 0.95,
    topGenres: ['Indie Rock', 'Synthpop', 'Alternative'],
    vibeVector: { energy: 0.8, danceability: 0.7, valence: 0.6, tempo: 0.75 },
    status: 'accepted',
    hasChatted: false
  },
  {
    id: 'u2',
    name: 'Carlos',
    avatar: 'https://i.pravatar.cc/150?u=carlos',
    compatibilityScore: 0.92,
    topGenres: ['Techno', 'House', 'Electronic'],
    vibeVector: { energy: 0.9, danceability: 0.85, valence: 0.5, tempo: 0.9 },
    status: 'accepted',
    hasChatted: true
  },
  {
    id: 'u3',
    name: 'Andrea',
    avatar: 'https://i.pravatar.cc/150?u=andrea',
    compatibilityScore: 0.88,
    topGenres: ['Pop', 'R&B', 'Hip Hop'],
    vibeVector: { energy: 0.7, danceability: 0.9, valence: 0.8, tempo: 0.6 },
    status: 'accepted',
    hasChatted: false
  },
  {
    id: 'u4',
    name: 'Diego',
    avatar: 'https://i.pravatar.cc/150?u=diego',
    compatibilityScore: 0.81,
    topGenres: ['Rock', 'Metal', 'Grunge'],
    vibeVector: { energy: 0.95, danceability: 0.4, valence: 0.3, tempo: 0.8 },
    status: 'accepted',
    hasChatted: true
  },
  {
    id: 'u5',
    name: 'Lucía',
    avatar: 'https://i.pravatar.cc/150?u=lucia',
    compatibilityScore: 0.75,
    topGenres: ['Acoustic', 'Folk', 'Indie Pop'],
    vibeVector: { energy: 0.4, danceability: 0.5, valence: 0.7, tempo: 0.5 },
    status: 'accepted',
    hasChatted: false
  }
];

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchUser[]>(initialMatches);
  const [activeTab, setActiveTab] = useState<'matches' | 'chats'>('matches');

  const pendingMatches = matches.filter(m => !m.hasChatted);
  const activeChats = matches.filter(m => m.hasChatted);

  const handleConnect = (id: string) => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, status: 'pending' } : m));
    setTimeout(() => {
       // After connecting, we can consider them a chat
       setMatches(prev => prev.map(m => m.id === id ? { ...m, hasChatted: true, status: 'accepted' } : m));
       router.push({ pathname: '/(main)/chat/[id]', params: { id } });
    }, 800);
  };

  const renderMatchItem = ({ item }: { item: MatchUser }) => {
    const isCertified = item.compatibilityScore > 0.90;
    
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => handleConnect(item.id)}>
        <BlurView intensity={20} tint="dark" style={styles.chatCard}>
          <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
          <View style={styles.chatInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={styles.chatName}>{item.name}</Text>
              {isCertified && <Text style={{ fontSize: 12 }}>🌟</Text>}
            </View>
            <Text style={[styles.chatPreview, { color: '#F366FF' }]} numberOfLines={1}>¡Nuevo Match! Toca para saludar 👋</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  const renderChatItem = ({ item }: { item: MatchUser }) => {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push({ pathname: '/(main)/chat/[id]', params: { id: item.id } })}>
        <BlurView intensity={20} tint="dark" style={styles.chatCard}>
          <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
          <View style={styles.chatInfo}>
            <Text style={styles.chatName}>{item.name}</Text>
            <Text style={styles.chatPreview} numberOfLines={1}>Toca para ver la conversación...</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#181818', '#2a1a3a', '#181818']} style={[StyleSheet.absoluteFillObject, { opacity: 0.6 }]} />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Header without Back Button */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tus Conexiones</Text>
            <Text style={styles.subtitle}>{matches.length} personas compatibles</Text>
          </View>
        </View>

        {/* Top Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'matches' && styles.tabButtonActive]}
            onPress={() => setActiveTab('matches')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'matches' && styles.tabButtonTextActive]}>Matches ({pendingMatches.length})</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'chats' && styles.tabButtonActive]}
            onPress={() => setActiveTab('chats')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'chats' && styles.tabButtonTextActive]}>Chats ({activeChats.length})</Text>
          </TouchableOpacity>
        </View>

        {/* List Content */}
        <FlatList
          data={activeTab === 'matches' ? pendingMatches : activeChats}
          keyExtractor={item => item.id}
          renderItem={activeTab === 'matches' ? renderMatchItem : renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_500Medium' }}>
                No tienes {activeTab === 'matches' ? 'matches pendientes' : 'chats activos'}.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  safeArea: { flex: 1 },
  header: { padding: 24, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16 },
  title: { color: '#FFF', fontSize: 24, fontFamily: 'GolosText_700Bold', marginBottom: 2 },
  subtitle: { color: '#F366FF', fontSize: 13, fontFamily: 'Inter_500Medium' },
  
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 12 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  tabButtonActive: { backgroundColor: 'rgba(243,102,255,0.15)', borderColor: 'rgba(243,102,255,0.4)' },
  tabButtonText: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium', fontSize: 14 },
  tabButtonTextActive: { color: '#F366FF', fontFamily: 'GolosText_700Bold' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  
  card: {
    borderRadius: 24, padding: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.05)'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16 },
  headerInfo: { flex: 1, justifyContent: 'center' },
  name: { color: '#FFF', fontSize: 20, fontFamily: 'GolosText_700Bold', marginBottom: 4 },
  badge: { backgroundColor: 'rgba(243, 102, 255, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 6 },
  badgeText: { color: '#F366FF', fontSize: 10, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  scoreText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter_500Medium' },
  scoreHighlight: { color: '#F366FF', fontFamily: 'GolosText_700Bold' },
  genresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  genrePill: { backgroundColor: 'rgba(163,85,247,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(163,85,247,0.4)' },
  genreText: { color: '#E9D5FF', fontSize: 12, fontFamily: 'Inter_500Medium' },
  actionsContainer: { flexDirection: 'row', gap: 12 },
  btnPass: { flex: 1, paddingVertical: 12, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  btnPassText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_500Medium' },
  btnConnect: { flex: 2, backgroundColor: '#F366FF', paddingVertical: 12, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  btnPending: { backgroundColor: 'rgba(243, 102, 255, 0.3)' },
  btnConnectText: { color: '#FFF', fontSize: 14, fontFamily: 'GolosText_700Bold' },

  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.03)' },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
  chatInfo: { flex: 1 },
  chatName: { color: '#FFF', fontSize: 16, fontFamily: 'GolosText_700Bold', marginBottom: 4 },
  chatPreview: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: 'Inter_500Medium' }
});
