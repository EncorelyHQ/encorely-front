import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { useAuth } from '../../context/AuthContext';
import { getRecommendations, SpotifyTrack } from '../../services/spotifyService';
import { useSwipes, SWIPE_THRESHOLD } from '../../hooks/useSwipes';
import { SwipeCard } from '../../components/SwipeCard';

const { width, height } = Dimensions.get('window');

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: #0A0A0F;
  align-items: center;
`;

const Header = styled.View`
  width: 100%;
  padding: 20px;
  align-items: center;
  z-index: 10;
`;

const Title = styled.Text`
  color: #FFF;
  font-size: 24px;
  font-weight: bold;
`;

const DeckContainer = styled.View`
  flex: 1;
  width: ${width * 0.9}px;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
`;

const ProgressContainer = styled.View`
  width: 90%;
  padding: 20px;
  align-items: center;
`;

const ProgressBarBg = styled.View`
  width: 100%;
  height: 8px;
  background-color: #333;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressBarFill = styled.View<{ progress: number }>`
  height: 100%;
  width: ${(props: { progress: number }) => props.progress * 100}%;
  background-color: #1DB954;
`;

const ProgressText = styled.Text`
  color: #aaa;
  font-size: 14px;
  font-weight: 600;
`;

export default function SwipeScreen() {
  const router = useRouter();
  const { accessToken } = useSpotifyAuth();
  const { swipeCount, isRadarUnlocked, incrementSwipe, isLoading: countsLoading } = useSwipes();

  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMoreTracks = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      // 1. Intentamos obtener verdaderos Top Tracks del usuario para evitar 404
      const { getTopTracks } = require('../../services/spotifyService');
      const userTopTracks = await getTopTracks(accessToken, 5);
      
      let seedTracks: string[] = [];

      if (userTopTracks && userTopTracks.length > 0) {
        seedTracks = userTopTracks.map((t: SpotifyTrack) => t.id);
      } else {
        // Fallback global súper validos si el usuario es nuevo
        // 4PTG3Z6ehGkBFwjybzWkR8 (HUMBLE) | 7ouMYWcgJqbhb0Z74rA010 (Bohemian Rhapsody)
        seedTracks = ['4PTG3Z6ehGkBFwjybzWkR8', '7ouMYWcgJqbhb0Z74rA010']; 
      }

      console.log('[SwipeScreen] Fetching recommendations seeds:', seedTracks);
      const newTracks = await getRecommendations(accessToken, seedTracks, 20);
      setTracks((prev) => [...prev, ...newTracks]);
    } catch (e) {
      console.warn('[SwipeScreen] Fetch tracks failed:', e);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && tracks.length === 0) {
      fetchMoreTracks();
    }
  }, [accessToken, fetchMoreTracks, tracks.length]);

  // Handle Radar Unlock Redirect
  useEffect(() => {
    if (isRadarUnlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Wait a moment for UX before navigating
      setTimeout(() => {
        router.replace('/(main)'); // Temporary: redirect home or radar
      }, 1000);
    }
  }, [isRadarUnlocked, router]);

  const handleSwipe = async (direction: 'left' | 'right') => {
    // 1. Remove the top track
    setTracks((prev) => prev.slice(1));
    
    // 2. Increment counter
    await incrementSwipe();

    // 3. Fetch more if running low
    if (tracks.length < 5) {
      fetchMoreTracks();
    }
  };

  if (countsLoading || (loading && tracks.length === 0)) {
    return (
      <Container style={{ justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Calculando tu Vibe...</Text>
      </Container>
    );
  }

  if (isRadarUnlocked) {
    return (
      <Container style={{ justifyContent: 'center' }}>
        <Ionicons name="radar-outline" size={100} color="#1DB954" />
        <Title style={{ marginTop: 20 }}>¡Radar Desbloqueado!</Title>
      </Container>
    );
  }

  // Display top 3 tracks to avoid rendering too many Audio components
  const visibleTracks = tracks.slice(0, 3).reverse();

  return (
    <Container>
      <Header>
        <Title>Descubre tu Vibe</Title>
      </Header>

      <DeckContainer>
        {tracks.length === 0 ? (
          <Text style={{ color: '#aaa' }}>No hay más canciones :(</Text>
        ) : (
          visibleTracks.map((track, index) => {
            const isFront = index === visibleTracks.length - 1;
            return (
              <View
                key={track.id + index}
                style={[
                  StyleSheet.absoluteFillObject,
                  { padding: 10 },
                ]}
                pointerEvents={isFront ? 'auto' : 'none'}
              >
                <SwipeCard track={track} isFront={isFront} onSwipe={handleSwipe} />
              </View>
            );
          })
        )}
      </DeckContainer>

      <ProgressContainer>
        <ProgressBarBg>
          <ProgressBarFill progress={Math.min(swipeCount / SWIPE_THRESHOLD, 1)} />
        </ProgressBarBg>
        <ProgressText>
          {swipeCount} / {SWIPE_THRESHOLD} Swipes para Desbloquear Radar
        </ProgressText>
      </ProgressContainer>
    </Container>
  );
}
