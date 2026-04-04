import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/shared/context/AuthContext';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { useVibeVector } from '@/shared/hooks/useVibeVector';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const Container = styled.View`
  flex: 1;
  background-color: #181818;
`;

const GlassCard = styled(BlurView)`
  border-radius: 24px;
  padding: 20px;
  overflow: hidden;
  border-width: 1px;
  border-color: rgba(255,255,255,0.05);
  background-color: rgba(255,255,255,0.03);
  margin-bottom: 20px;
`;

const SettingRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-vertical: 12px;
`;

const SettingLabel = styled.Text`
  color: #FFF;
  font-size: 16px;
  font-family: 'Inter_500Medium';
`;

const SectionTitle = styled.Text`
  color: rgba(255,255,255,0.4);
  font-size: 12px;
  font-family: 'GolosText_700Bold';
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  margin-left: 4px;
`;

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, setSession, user, vibeVector } = useAuth();
  const { logout: spotifyLogout, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, isLoading: isComputing } = useVibeVector();
  
  const [isRadarVisible, setIsRadarVisible] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres salir?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Cerrar Sesión", 
          style: "destructive",
          onPress: async () => {
            await spotifyLogout();
            await logout();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const handleSyncVibe = async () => {
    const token = await getValidToken();
    if (!token) return;
    
    const newVibe = await computeVibe(token);
    if (newVibe && user) {
      await setSession(user, token, newVibe);
      Alert.alert("Éxito", "Tu Vibe Vector ha sido actualizado con tus últimas escuchas.");
    }
  };

  return (
    <Container>
      <LinearGradient colors={['#181818', '#2a1a3a', '#181818']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Ajustes</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <SectionTitle>Privacidad y Radar</SectionTitle>
          <GlassCard intensity={20}>
            <SettingRow>
              <SettingLabel>Visible en Radar Social</SettingLabel>
              <Switch 
                value={isRadarVisible} 
                onValueChange={setIsRadarVisible}
                trackColor={{ false: '#333', true: '#F366FF' }}
                thumbColor="#FFF"
              />
            </SettingRow>
            <Text style={styles.description}>
              Si desactivas esto, otros usuarios no podrán verte en el radar ni enviarte solicitudes.
            </Text>
          </GlassCard>

          <SectionTitle>Perfil Musical</SectionTitle>
          <GlassCard intensity={20}>
            <TouchableOpacity onPress={handleSyncVibe} disabled={isComputing}>
              <SettingRow>
                <SettingLabel>Sincronizar Vibe</SettingLabel>
                {isComputing ? (
                  <ActivityIndicator color="#F366FF" size="small" />
                ) : (
                  <Ionicons name="sync-outline" size={20} color="#F366FF" />
                )}
              </SettingRow>
            </TouchableOpacity>
            <Text style={styles.description}>
              Calcula de nuevo tu ADN musical basándote en lo que has estado escuchando recientemente en Spotify.
            </Text>
          </GlassCard>

          <SectionTitle>Cuenta</SectionTitle>
          <GlassCard intensity={20}>
            <TouchableOpacity onPress={handleLogout}>
              <SettingRow>
                <SettingLabel style={{ color: '#FF4B4B' }}>Cerrar Sesión</SettingLabel>
                <Ionicons name="log-out-outline" size={20} color="#FF4B4B" />
              </SettingRow>
            </TouchableOpacity>
          </GlassCard>

          <View style={styles.footer}>
            <Text style={styles.version}>Encorely v1.0.0-MVP</Text>
            <Text style={styles.copyright}>© 2026 Encorely Team</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Container>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'GolosText_700Bold',
  },
  description: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 4,
  },
  version: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  copyright: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
  }
});
