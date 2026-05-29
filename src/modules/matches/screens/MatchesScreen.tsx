import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/shared/context/AuthContext';
import { getPendingMatches, acceptMatch, ApiError, type PendingMatch } from '@/clients/api';

/** Avatar placeholder determinista (el backend aún no expone avatares). */
const avatarFor = (seed: string) => `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;

/** AffinityScore llega 0–100; lo normalizamos a 0–1 para la UI. */
const toScore01 = (compatibility: number) => (compatibility > 1 ? compatibility / 100 : compatibility);

export default function MatchesScreen() {
  const router = useRouter();
  const { backendUserId } = useAuth();

  const [matches, setMatches] = useState<PendingMatch[]>([]);
  const [openedRooms, setOpenedRooms] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'matches' | 'chats'>('matches');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    if (!backendUserId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getPendingMatches(backendUserId);
      setMatches(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'No se pudieron cargar tus matches';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [backendUserId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const pendingMatches = matches.filter((m) => !openedRooms.has(m.matchId));
  const activeChats = matches.filter((m) => openedRooms.has(m.matchId));

  const handleConnect = async (matchId: string) => {
    if (!backendUserId) return;
    try {
      const { roomId } = await acceptMatch(matchId, backendUserId);
      setOpenedRooms((prev) => new Set(prev).add(matchId));
      router.push({ pathname: '/(main)/chat/[id]', params: { id: roomId } });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'No se pudo aceptar el match';
      setError(msg);
    }
  };

  const renderMatchItem = ({ item }: { item: PendingMatch }) => {
    const isCertified = toScore01(item.compatibility) > 0.9;
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => handleConnect(item.matchId)}>
        <BlurView intensity={20} tint="dark" style={styles.chatCard}>
          <Image source={{ uri: avatarFor(item.matchId) }} style={styles.chatAvatar} />
          <View style={styles.chatInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={styles.chatName}>{item.displayName}</Text>
              {isCertified && <Text style={{ fontSize: 12 }}>🌟</Text>}
            </View>
            <Text style={[styles.chatPreview, { color: '#F366FF' }]} numberOfLines={1}>¡Nuevo Match! Toca para saludar 👋</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  const renderChatItem = ({ item }: { item: PendingMatch }) => {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push({ pathname: '/(main)/chat/[id]', params: { id: item.matchId } })}>
        <BlurView intensity={20} tint="dark" style={styles.chatCard}>
          <Image source={{ uri: avatarFor(item.matchId) }} style={styles.chatAvatar} />
          <View style={styles.chatInfo}>
            <Text style={styles.chatName}>{item.displayName}</Text>
            <Text style={styles.chatPreview} numberOfLines={1}>Toca para ver la conversación...</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
        </BlurView>
      </TouchableOpacity>
    );
  };

  const listData = activeTab === 'matches' ? pendingMatches : activeChats;

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
        {loading ? (
          <ActivityIndicator color="#F366FF" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.matchId}
            renderItem={activeTab === 'matches' ? renderMatchItem : renderChatItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadMatches}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                  {error
                    ? error
                    : !backendUserId
                    ? 'Conecta tu cuenta para ver tus matches.'
                    : `No tienes ${activeTab === 'matches' ? 'matches pendientes' : 'chats activos'}.`}
                </Text>
              </View>
            }
          />
        )}
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
