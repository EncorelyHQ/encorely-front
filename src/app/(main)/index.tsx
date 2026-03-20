import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { VibeVector } from '../../hooks/useVibeVector';
import { useRouter } from 'expo-router';
import { useSwipes, SWIPE_THRESHOLD } from '../../hooks/useSwipes';

// ─── Vibe Bar ──────────────────────────────────────────────────────────────────
interface VibeBarProps {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}

function VibeBar({ label, value, color, suffix = '%' }: VibeBarProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 800,
      delay: 150,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[styles.barValue, { color }]}>
        {Math.round(value * 100)}{suffix}
      </Text>
    </View>
  );
}

// ─── Vibe Card ────────────────────────────────────────────────────────────────
function VibeCard({ vibe }: { vibe: VibeVector }) {
  const bars = [
    { label: 'Energy',    value: vibe.energy,       color: theme.colors.primary },
    { label: 'Baile',     value: vibe.danceability,  color: '#F97316' },
    { label: 'Valencia',  value: vibe.valence,       color: '#EAB308' },
    { label: 'Tempo',     value: vibe.tempo,         color: theme.colors.accent },
  ];

  // Overall vibe score = mean of all dims
  const score = Math.round(
    bars.reduce((s, b) => s + b.value, 0) / bars.length * 100
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>⚡ Tu Vector de Vibe</Text>
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>Score {score}</Text>
        </View>
      </View>
      <View style={styles.barList}>
        {bars.map((b) => <VibeBar key={b.label} {...b} />)}
      </View>
    </View>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user: authUser, vibeVector, logout } = useAuth();
  const { user: spotifyUser } = useSpotifyAuth();
  const { swipeCount, isRadarUnlocked } = useSwipes();

  const progressPercent = Math.min((swipeCount / SWIPE_THRESHOLD) * 100, 100);

  const displayUser = spotifyUser ?? authUser;

  const handleLogout = async () => {
    await logout();
  };

  if (!displayUser) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {spotifyUser?.avatar ? (
              <Image source={{ uri: spotifyUser.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {displayUser.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.greeting}>Hola, {displayUser.name.split(' ')[0]} 👋</Text>
              <Text style={styles.subGreeting}>Vibe activo · SDK 54</Text>
            </View>
          </View>
          <View style={styles.activeDot} />
        </View>

        {/* Vibe Card */}
        {vibeVector ? (
          <VibeCard vibe={vibeVector} />
        ) : (
          <View style={[styles.card, styles.noVibeCard]}>
            <Text style={styles.noVibeText}>
              ⚡ Calculando tu Vector de Vibe...
            </Text>
          </View>
        )}

        {/* Stats Row */}
        {vibeVector && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(vibeVector.tempo * 200)}</Text>
              <Text style={styles.statLabel}>BPM avg</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(vibeVector.energy * 100)}%</Text>
              <Text style={styles.statLabel}>Energy</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(vibeVector.valence * 100)}%</Text>
              <Text style={styles.statLabel}>Mood</Text>
            </View>
          </View>
        )}

        {/* Radar Placeholder */}
        <TouchableOpacity 
          style={[styles.card, styles.radarCard]}
          activeOpacity={0.8}
          onPress={() => router.push(isRadarUnlocked ? '/(main)/radar' : '/(main)/swipe')}
        >
          <Text style={styles.radarIcon}>{isRadarUnlocked ? '🌍' : '📡'}</Text>
          <Text style={styles.radarTitle}>{isRadarUnlocked ? 'Radar Social Activo' : 'Desbloquea el Radar'}</Text>
          <Text style={styles.radarSub}>
            {isRadarUnlocked 
              ? 'Descubre fans de conciertos cerca de ti con tu mismo Vibe.'
              : `Disponible al alcanzar ${SWIPE_THRESHOLD} swipes.\nEvalúa tracks para activar el mapa.`}
          </Text>
          <View style={styles.progress}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{swipeCount} / {SWIPE_THRESHOLD} swipes</Text>
          
          <View style={[styles.actionBtn, isRadarUnlocked && styles.actionBtnActive]}>
             <Text style={styles.actionBtnText}>{isRadarUnlocked ? 'Abrir Mapa' : 'Empezar Swipes'}</Text>
          </View>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Encorely v1.0 · Beta · Spotify</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 22, gap: 14, paddingBottom: 48 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#1DB954' },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 2, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  greeting: { fontSize: 20, fontWeight: '900', color: theme.colors.text, letterSpacing: -0.5 },
  subGreeting: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  activeDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#1DB954',
    shadowColor: '#1DB954', shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },

  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 0.8 },
  scorePill: {
    backgroundColor: theme.colors.accent + '22',
    borderWidth: 1, borderColor: theme.colors.accent,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  scoreText: { color: theme.colors.accentLight, fontSize: 11, fontWeight: '800' },
  noVibeCard: { alignItems: 'center', paddingVertical: 28 },
  noVibeText: { color: theme.colors.textMuted, fontSize: 14 },

  // Vibe bars
  barList: { gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 66, fontSize: 12, fontWeight: '700', color: theme.colors.text },
  barTrack: { flex: 1, height: 7, backgroundColor: theme.colors.surfaceHigh, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  barValue: { width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },

  // Radar
  radarCard: { alignItems: 'center', gap: 8 },
  radarIcon: { fontSize: 42, marginBottom: 4 },
  radarTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
  radarSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  progress: { width: '100%', height: 6, backgroundColor: theme.colors.surfaceHigh, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 99 },
  progressLabel: { fontSize: 12, color: theme.colors.textDim, fontWeight: '600' },

  // Logout
  logoutBtn: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '700' },
  version: { textAlign: 'center', color: theme.colors.textDim, fontSize: 12 },

  // Call to action
  actionBtn: { marginTop: 12, backgroundColor: theme.colors.surfaceHigh, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 99 },
  actionBtnActive: { backgroundColor: theme.colors.primary },
  actionBtnText: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
});
