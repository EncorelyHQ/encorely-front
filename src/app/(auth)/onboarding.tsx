import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useVibeVector } from '../../hooks/useVibeVector';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// ─── Slide 1: Welcome ─────────────────────────────────────────────────────────
function SlideWelcome({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.slide}>
      <View style={styles.logoBlock}>
        <Text style={styles.logoEmoji}>🎵</Text>
        <Text style={styles.logoText}>Encorely</Text>
        <View style={styles.betaBadge}><Text style={styles.betaText}>BETA</Text></View>
      </View>
      <Text style={styles.heroTitle}>Encuentra{'\n'}tu tribu.</Text>
      <Text style={styles.heroSub}>
        Conecta con fans en conciertos que comparten exactamente tu vibe.
        No likes, no followers — pura compatibilidad musical.
      </Text>
      <View style={styles.chips}>
        {['🎫 Conciertos', '🎯 Matching', '📡 Radar'].map((c) => (
          <View key={c} style={styles.chip}>
            <Text style={styles.chipText}>{c}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
        <Text style={styles.nextBtnText}>Siguiente →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Slide 2: Vibe Vector ─────────────────────────────────────────────────────
const DIMS = [
  { label: 'Energy', value: 0.78, color: theme.colors.primary },
  { label: 'Baile', value: 0.65, color: '#F97316' },
  { label: 'Valencia', value: 0.52, color: '#EAB308' },
  { label: 'Tempo', value: 0.84, color: theme.colors.accent },
];

function AnimatedBar({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, {
        backgroundColor: color,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />
    </View>
  );
}

function SlideVibeVector({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.slide}>
      <Text style={styles.tag}>TU PERFIL MUSICAL</Text>
      <Text style={styles.slideTitle}>Vector{'\n'}de Vibe</Text>
      <Text style={styles.slideSub}>
        Analizamos tus últimas 50 canciones en Spotify y calculamos
        4 dimensiones de tu gusto musical.
      </Text>
      <View style={styles.dimList}>
        {DIMS.map((d) => (
          <View key={d.label} style={styles.dimRow}>
            <Text style={styles.dimLabel}>{d.label}</Text>
            <AnimatedBar value={d.value} color={d.color} />
            <Text style={[styles.dimVal, { color: d.color }]}>{Math.round(d.value * 100)}%</Text>
          </View>
        ))}
      </View>
      <View style={styles.matchPill}>
        <Text style={styles.matchText}>🎯 Match coseno {'>'} 70% = conexión real</Text>
      </View>
      <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
        <Text style={styles.nextBtnText}>Conectar Spotify →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Slide 3: Spotify Connect ─────────────────────────────────────────────────
function SlideConnect() {
  const router = useRouter();
  const { user, isLoggingIn, error, login, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, usedFallback } = useVibeVector();
  const { setSession } = useAuth();
  const [computing, setComputing] = useState(false);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setComputing(true);
      const token = await getValidToken();
      if (!token) { setComputing(false); return; }
      const vibe = await computeVibe(token);
      await setSession(user, token, vibe);
      if (usedFallback) {
        Alert.alert(
          '🎵 Vibe Básico Activado',
          'Usando análisis de metadatos. Para mayor precisión, actualiza los permisos de tu app Spotify.',
          [{ text: 'Entendido' }]
        );
      }
      setComputing(false);
      router.replace('/(main)');
    })();
  }, [user]);

  return (
    <View style={styles.slide}>
      <Text style={styles.tag}>LISTO PARA COMENZAR</Text>
      <Text style={styles.slideTitle}>Conecta{'\n'}Spotify.</Text>
      <Text style={styles.slideSub}>
        Autorizamos acceso a tu historial de reproducción.{'\n'}
        No almacenamos tus canciones ni tus datos de escucha.
      </Text>
      <View style={styles.permList}>
        {[
          '✅ Historial de reproducción (últimas 50)',
          '✅ Tu perfil público',
          '❌ Playlists (no requeridas)',
        ].map((p) => (
          <Text key={p} style={styles.permItem}>{p}</Text>
        ))}
      </View>
      {error ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>⚠️ {error}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.spotifyBtn, (isLoggingIn || computing) && styles.spotifyBtnDim]}
        onPress={login}
        disabled={isLoggingIn || computing}
      >
        {(isLoggingIn || computing) ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.spotifyBtnText}>♪  Conectar con Spotify</Text>
        )}
      </TouchableOpacity>
      {computing && (
        <Text style={styles.computingText}>⚡ Calculando tu Vector de Vibe...</Text>
      )}
    </View>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
const SLIDES = ['welcome', 'vibe', 'connect'] as const;

export default function OnboardingScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    const next = Math.min(currentIndex + 1, SLIDES.length - 1);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[number] }) => (
    <View style={{ width }}>
      {item === 'welcome' && <SlideWelcome onNext={goNext} />}
      {item === 'vibe' && <SlideVibeVector onNext={goNext} />}
      {item === 'connect' && <SlideConnect />}
    </View>
  );

  const dots = SLIDES.map((_, i) => {
    const scaleX = scrollX.interpolate({
      inputRange: [(i - 1) * width, i * width, (i + 1) * width],
      outputRange: [1, 2.4, 1],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange: [(i - 1) * width, i * width, (i + 1) * width],
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });
    return <Animated.View key={i} style={[styles.dot, { opacity, transform: [{ scaleX }] }]} />;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      />
      <View style={styles.dotsRow}>{dots}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  slide: { width, flex: 1, paddingHorizontal: 28, paddingTop: 44, paddingBottom: 16 },
  // Logo
  logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoEmoji: { fontSize: 30 },
  logoText: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  betaBadge: { backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  betaText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  // Hero
  heroTitle: { fontSize: 52, fontWeight: '900', color: theme.colors.text, letterSpacing: -2, lineHeight: 56, marginBottom: 16 },
  heroSub: { fontSize: 15, color: theme.colors.textMuted, lineHeight: 24, marginBottom: 28 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  chip: { backgroundColor: theme.colors.surfaceHigh, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: theme.colors.border },
  chipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  // Slide generic
  tag: { fontSize: 11, fontWeight: '700', color: theme.colors.primary, letterSpacing: 2, marginBottom: 12 },
  slideTitle: { fontSize: 42, fontWeight: '900', color: theme.colors.text, letterSpacing: -1.5, lineHeight: 46, marginBottom: 14 },
  slideSub: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 22, marginBottom: 24 },
  // Vibe dims
  dimList: { gap: 14, marginBottom: 24 },
  dimRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dimLabel: { width: 64, fontSize: 12, fontWeight: '700', color: theme.colors.text },
  bar: { flex: 1, height: 6, backgroundColor: theme.colors.surfaceHigh, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  dimVal: { width: 34, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  matchPill: { alignSelf: 'flex-start', backgroundColor: theme.colors.accent + '22', borderWidth: 1, borderColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, marginBottom: 28 },
  matchText: { color: theme.colors.accentLight, fontSize: 12, fontWeight: '700' },
  // Spotify connect slide
  permList: { gap: 10, marginBottom: 24 },
  permItem: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  errBox: { backgroundColor: '#7F1D1D22', borderWidth: 1, borderColor: '#EF4444', borderRadius: theme.radius.md, padding: 12, marginBottom: 12 },
  errText: { color: '#FCA5A5', fontSize: 13, textAlign: 'center' },
  spotifyBtn: { backgroundColor: '#1DB954', borderRadius: theme.radius.lg, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  spotifyBtnDim: { opacity: 0.6 },
  spotifyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  computingText: { color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
  // Buttons
  nextBtn: { alignSelf: 'flex-end', backgroundColor: theme.colors.surfaceHigh, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 99 },
  nextBtnText: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  // Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
});
