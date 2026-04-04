import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/shared/context/AuthContext';

export default function ProfileScreen() {
  const { user, vibeVector } = useAuth();
  
  const displayUser = user || { name: 'Encorely User' };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Perfil</Text>
          <Ionicons name="settings-outline" size={24} color="#FFF" />
        </View>

        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={60} color="#181818" />
          </View>
          <Text style={styles.name}>{displayUser.name}</Text>
          <Text style={styles.subtitle}>Encorely Vibe Explorer</Text>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Tus Estadísticas Musicales</Text>
          
          <VibeBar label="Energy" value={vibeVector?.energy ?? 0} />
          <VibeBar label="Danceability" value={vibeVector?.danceability ?? 0} />
          <VibeBar label="Valence" value={vibeVector?.valence ?? 0} />
          <VibeBar label="Tempo" value={vibeVector?.tempo ?? 0} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VibeBar({ label, value }: { label: string, value: number }) {
  return (
    <View style={styles.vibeBarContainer}>
      <Text style={styles.vibeLabel}>{label}</Text>
      <View style={styles.barBg}>
        <LinearGradient
          colors={['#F366FF', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${value * 100}%` }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181818',
  },
  scrollContent: {
    paddingBottom: 110, // padding for bottom tabs
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontFamily: 'GolosText_700Bold',
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F366FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  name: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'GolosText_700Bold',
  },
  subtitle: {
    color: '#F366FF',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontFamily: 'GolosText_700Bold',
    fontSize: 18,
    marginBottom: 20,
  },
  vibeBarContainer: {
    marginBottom: 16,
  },
  vibeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 8,
  },
  barBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  }
});
