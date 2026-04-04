import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { VibeVector } from '@/shared/types/vibe';
import { LinearGradient } from 'expo-linear-gradient';

type MatchUser = {
  id: string;
  name: string;
  avatar: string;
  compatibilityScore: number;
  topGenres: string[];
  vibeVector: VibeVector;
  status: 'pending' | 'accepted';
};

const initialMatches: MatchUser[] = [
  {
    id: 'u1',
    name: 'Valeria',
    avatar: 'https://i.pravatar.cc/150?u=valeria',
    compatibilityScore: 0.95,
    topGenres: ['Indie Rock', 'Synthpop', 'Alternative'],
    vibeVector: { energy: 0.8, danceability: 0.7, valence: 0.6, tempo: 0.75 },
    status: 'accepted'
  },
  {
    id: 'u2',
    name: 'Carlos',
    avatar: 'https://i.pravatar.cc/150?u=carlos',
    compatibilityScore: 0.92,
    topGenres: ['Techno', 'House', 'Electronic'],
    vibeVector: { energy: 0.9, danceability: 0.85, valence: 0.5, tempo: 0.9 },
    status: 'accepted'
  },
  {
    id: 'u3',
    name: 'Andrea',
    avatar: 'https://i.pravatar.cc/150?u=andrea',
    compatibilityScore: 0.88,
    topGenres: ['Pop', 'R&B', 'Hip Hop'],
    vibeVector: { energy: 0.7, danceability: 0.9, valence: 0.8, tempo: 0.6 },
    status: 'accepted'
  },
  {
    id: 'u4',
    name: 'Diego',
    avatar: 'https://i.pravatar.cc/150?u=diego',
    compatibilityScore: 0.81,
    topGenres: ['Rock', 'Metal', 'Grunge'],
    vibeVector: { energy: 0.95, danceability: 0.4, valence: 0.3, tempo: 0.8 },
    status: 'accepted'
  },
  {
    id: 'u5',
    name: 'Lucía',
    avatar: 'https://i.pravatar.cc/150?u=lucia',
    compatibilityScore: 0.75,
    topGenres: ['Acoustic', 'Folk', 'Indie Pop'],
    vibeVector: { energy: 0.4, danceability: 0.5, valence: 0.7, tempo: 0.5 },
    status: 'accepted'
  }
];

export default function MatchesScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchUser[]>(initialMatches);

  const handleConnect = (id: string) => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, status: 'pending' } : m));
    // Simulate navigation to chat after connection
    setTimeout(() => {
       router.push({ pathname: '/(main)/chat/[id]', params: { id } });
    }, 800);
  };

  const renderItem = ({ item }: { item: MatchUser }) => {
    const isCertified = item.compatibilityScore > 0.90;
    
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => router.push({ pathname: '/(main)/chat/[id]', params: { id: item.id } })}>
        <BlurView intensity={40} tint="dark" style={styles.card}>
          <View style={styles.cardHeader}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{item.name}</Text>
              {isCertified && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>🌟 Match Certificado</Text>
                </View>
              )}
              <Text style={styles.scoreText}>
                <Text style={styles.scoreHighlight}>{Math.round(item.compatibilityScore * 100)}%</Text> compatible
              </Text>
            </View>
          </View>

          <View style={styles.genresContainer}>
            {item.topGenres.map(genre => (
              <View key={genre} style={styles.genrePill}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.btnPass}>
              <Text style={styles.btnPassText}>Pasar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnConnect, item.status === 'pending' && styles.btnPending]}
              onPress={() => handleConnect(item.id)}
              disabled={item.status === 'pending'}
            >
              <Text style={styles.btnConnectText}>
                {item.status === 'pending' ? 'Solicitud enviada ✓' : 'Conectar 🎵'}
              </Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#181818', '#2a1a3a', '#181818']} style={[StyleSheet.absoluteFillObject, { opacity: 0.6 }]} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Tus Matches Musicales</Text>
          <Text style={styles.subtitle}>{matches.length} personas compatibles</Text>
        </View>
        <FlatList
          data={matches}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#181818' },
  safeArea: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  title: { color: '#FFF', fontSize: 28, fontFamily: 'GolosText_700Bold', marginBottom: 4 },
  subtitle: { color: '#F366FF', fontSize: 14, fontFamily: 'Inter_500Medium' },
  listContent: { paddingHorizontal: 20, paddingBottom: 110, gap: 16 },
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
  btnConnectText: { color: '#FFF', fontSize: 14, fontFamily: 'GolosText_700Bold' }
});
