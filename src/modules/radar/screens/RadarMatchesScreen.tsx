import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/shared/context/AuthContext';
import {
  getEventsFeed,
  getEventMatches,
  moodEnumToString,
  formatApiError,
  ApiError,
  type RadarMatch,
} from '@/clients/api';

const avatarFor = (seed: string) => `https://i.pravatar.cc/150?u=${encodeURIComponent(seed)}`;

export default function RadarMatchesScreen() {
  const router = useRouter();
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();
  const { backendUserId } = useAuth();

  const [matches, setMatches] = useState<RadarMatch[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!backendUserId) {
      setError('Conecta tu cuenta para usar el radar.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // El radar del backend es por evento; si no llega eventId usamos el primero del feed.
      let eventId = eventIdParam;
      if (!eventId) {
        const feed = await getEventsFeed();
        eventId = feed[0]?.id;
      }
      if (!eventId) {
        setMatches([]);
        setError('No hay eventos disponibles para el radar.');
        return;
      }
      const data = await getEventMatches(eventId, backendUserId);
      setMatches(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError('Completá 25 swipes para desbloquear el radar.');
      } else {
        setError(formatApiError(e, 'No se pudo cargar el radar.'));
      }
    } finally {
      setLoading(false);
    }
  }, [backendUserId, eventIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = (id: string) => {
    // El backend genera matches vía el pipeline de swipes; aquí solo marcamos
    // localmente la solicitud (no hay endpoint de "conectar" desde el radar).
    setRequested((prev) => new Set(prev).add(id));
  };

  const renderItem = ({ item }: { item: RadarMatch }) => {
    const score01 = item.affinity > 1 ? item.affinity / 100 : item.affinity;
    const isCertified = item.isHighPriority || score01 > 0.9;
    const isPending = requested.has(item.id);
    const moodLabel = moodEnumToString(item.mood);

    return (
      <TouchableOpacity activeOpacity={0.9}>
        <BlurView intensity={40} tint="dark" style={styles.card}>
          <View style={styles.cardHeader}>
            <Image source={{ uri: avatarFor(item.id) }} style={styles.avatar} />
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{item.displayName}</Text>
              {isCertified && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>🌟 Match Certificado</Text>
                </View>
              )}
              <Text style={styles.scoreText}>
                <Text style={styles.scoreHighlight}>{Math.round(score01 * 100)}%</Text> compatible
              </Text>
            </View>
          </View>

          <View style={styles.genresContainer}>
            <View style={styles.genrePill}>
              <Text style={styles.genreText}>{moodLabel}</Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.btnPass}>
              <Text style={styles.btnPassText}>Pasar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConnect, isPending && styles.btnPending]}
              onPress={() => handleConnect(item.id)}
              disabled={isPending}
            >
              <Text style={styles.btnConnectText}>
                {isPending ? 'Solicitud enviada ✓' : 'Conectar 🎵'}
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Personas Compatibles</Text>
            <Text style={styles.subtitle}>{matches.length} personas cerca de ti</Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color="#F366FF" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={load}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                  {error ?? 'No hay personas compatibles por ahora.'}
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
  btnConnectText: { color: '#FFF', fontSize: 14, fontFamily: 'GolosText_700Bold' }
});
