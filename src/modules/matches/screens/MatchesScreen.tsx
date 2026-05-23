import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { usePendingMatches } from '@/modules/matches/hooks/usePendingMatches';
import { useAcceptMatch } from '@/modules/matches/hooks/useAcceptMatch';
import type { MatchCardView } from '@/modules/matches/types/match.types';

export default function MatchesScreen() {
  const router = useRouter();
  const { matches, loading, error, reload } = usePendingMatches();
  const { accept, accepting, error: acceptError } = useAcceptMatch();

  const handleConnect = async (item: MatchCardView) => {
    const roomId = await accept(item.id);
    if (roomId) {
      router.push({
        pathname: '/(main)/chat/[id]',
        params: { id: roomId, name: item.name },
      });
    }
  };

  const renderItem = ({ item }: { item: MatchCardView }) => {
    const isCertified = item.compatibilityScore > 0.9;

    return (
      <BlurView intensity={40} tint="dark" style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{item.name}</Text>
            {isCertified && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🌟 Match Certificado</Text>
              </View>
            )}
            <Text style={styles.scoreText}>
              <Text style={styles.scoreHighlight}>
                {Math.round(item.compatibilityScore * 100)}%
              </Text>{' '}
              compatible
            </Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.btnConnect, accepting && styles.btnPending]}
            onPress={() => void handleConnect(item)}
            disabled={accepting}
          >
            <Text style={styles.btnConnectText}>
              {accepting ? 'Conectando…' : 'Conectar 🎵'}
            </Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe}>
        <Text style={styles.screenTitle}>Matches</Text>
        {(error || acceptError) && (
          <Text style={styles.errorText}>{error ?? acceptError}</Text>
        )}
        {loading ? (
          <ActivityIndicator color="#F366FF" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No tenés matches pendientes.</Text>
            }
            refreshing={loading}
            onRefresh={() => void reload()}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  safe: { flex: 1, paddingHorizontal: 16 },
  screenTitle: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'GolosText_900Black',
    marginVertical: 16,
  },
  list: { gap: 16, paddingBottom: 40 },
  card: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardHeader: { flexDirection: 'row', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(243,102,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 22, fontFamily: 'GolosText_700Bold' },
  headerInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  name: { color: '#fff', fontSize: 18, fontFamily: 'GolosText_700Bold' },
  badge: {
    backgroundColor: 'rgba(243,102,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  badgeText: { color: '#F366FF', fontSize: 11, fontFamily: 'Inter_500Medium' },
  scoreText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },
  scoreHighlight: { color: '#F366FF', fontFamily: 'GolosText_700Bold' },
  actionsContainer: { flexDirection: 'row', gap: 10 },
  btnConnect: {
    flex: 1,
    backgroundColor: '#F366FF',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnPending: { opacity: 0.6 },
  btnConnectText: { color: '#fff', fontFamily: 'GolosText_700Bold', fontSize: 14 },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 40,
    fontFamily: 'Inter_500Medium',
  },
  errorText: { color: '#ff6b6b', marginBottom: 8, fontFamily: 'Inter_500Medium' },
});
