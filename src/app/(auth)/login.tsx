import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useVibeVector } from '../../hooks/useVibeVector';
import { useAuth } from '../../context/AuthContext';

// Simple toast replacement using Alert
function showFallbackToast() {
  Alert.alert(
    '🎵 Vibe Básico Activado',
    'Usando análisis de metadatos. Para mayor precisión, actualiza los permisos de tu app Spotify.',
    [{ text: 'Entendido' }]
  );
}

const SpotifyLogo = () => (
  <Text style={styles.spotifyIcon}>♪</Text>
);

function PulsingDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.dot, { transform: [{ scale: anim }] }]} />
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { user, isLoggingIn, error, login, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, usedFallback } = useVibeVector();
  const { setSession, user: authUser } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (authUser) router.replace('/(main)');
  }, [authUser]);

  // After Spotify user is available, compute vibe + store session
  useEffect(() => {
    if (!user) return;

    (async () => {
      const token = await getValidToken();
      if (!token) return;

      const vibe = await computeVibe(token);
      await setSession(user, token, vibe);

      if (usedFallback) showFallbackToast();

      router.replace('/(main)');
    })();
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo & Branding */}
        <View style={styles.top}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🎵</Text>
          </View>
          <Text style={styles.appName}>Encorely</Text>
          <Text style={styles.tagline}>Tu tribu musical te espera.</Text>
        </View>

        {/* Middle Feature List */}
        <View style={styles.features}>
          {[
            { icon: '⚡', text: 'Vector de Vibe desde tus canciones reales' },
            { icon: '🎯', text: 'Similitud coseno >70% = match garantizado' },
            { icon: '📡', text: 'Radar social en conciertos (Umbral 100)' },
          ].map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.bottom}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, (isLoggingIn) && styles.btnLoading]}
            onPress={login}
            disabled={isLoggingIn}
            activeOpacity={0.85}
          >
            {isLoggingIn ? (
              <View style={styles.btnInner}>
                <PulsingDot />
                <Text style={styles.btnText}>Conectando...</Text>
              </View>
            ) : (
              <View style={styles.btnInner}>
                <SpotifyLogo />
                <Text style={styles.btnText}>Conectar con Spotify</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Usamos tus últimas 50 canciones para calcular{'\n'}
            tu Vector de Vibe. No almacenamos tu historial.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingVertical: 40 },
  top: { alignItems: 'center', gap: 12 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.colors.primary, shadowOpacity: 0.4,
    shadowRadius: 20, elevation: 8,
  },
  logoEmoji: { fontSize: 38 },
  appName: { fontSize: 36, fontWeight: '900', color: theme.colors.text, letterSpacing: -1 },
  tagline: { fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
  features: { gap: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { fontSize: 22, width: 32 },
  featureText: { flex: 1, color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  bottom: { gap: 16 },
  errorBox: {
    backgroundColor: '#7F1D1D22',
    borderWidth: 1, borderColor: '#EF4444',
    borderRadius: theme.radius.md,
    padding: 12,
  },
  errorText: { color: '#FCA5A5', fontSize: 13, textAlign: 'center' },
  btn: {
    backgroundColor: '#1DB954',
    borderRadius: theme.radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  btnLoading: { opacity: 0.7 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spotifyIcon: { fontSize: 22, color: '#fff' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  disclaimer: {
    color: theme.colors.textDim, fontSize: 12,
    textAlign: 'center', lineHeight: 18,
  },
});
