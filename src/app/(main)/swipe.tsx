import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useSpotifyAuth } from '../../hooks/useSpotifyAuth';
import { spotifySwipeService, SwipeTrack } from '../../services/spotifySwipeService';
import { useSwipeEngine } from '../../hooks/useSwipeEngine';
import { SwipeStack } from '../../components/SwipeStack';
import { ProgressFooter } from '../../components/ProgressFooter';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

const Container = styled.View`
  flex: 1;
  background-color: #181818;
`;

const BackgroundGradient = styled(LinearGradient)`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  opacity: 0.6;
`;

const StyledSafeArea = styled(SafeAreaView)`
  flex: 1;
  align-items: center;
`;

const Header = styled.View`
  width: 100%;
  padding: 20px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
`;

const TitleContainer = styled.View`
  align-items: center;
`;

const HeaderTitle = styled.Text`
  color: #FFF;
  font-size: 20px;
  font-family: 'GolosText_700Bold';
`;

const HeaderSubtitle = styled.Text`
  color: #F366FF;
  font-size: 13px;
  font-family: 'Inter_500Medium';
  margin-top: 2px;
`;

const ProfileSmall = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #A855F7;
  align-items: center;
  justify-content: center;
  border-width: 2px;
  border-color: rgba(255,255,255,0.2);
`;

const EpicModalContainer = styled.View`
  flex: 1;
  background-color: #181818;
  align-items: center;
  justify-content: center;
`;

const EpicTitle = styled.Text`
  color: #F366FF;
  font-size: 32px;
  font-family: 'GolosText_700Bold';
  margin-top: 24px;
  text-align: center;
  text-shadow-color: rgba(243, 102, 255, 0.5);
  text-shadow-offset: 0px 4px;
  text-shadow-radius: 20px;
`;

export default function SwipeScreen() {
  const router = useRouter();
  const { accessToken } = useSpotifyAuth();
  const { swipesCount, hasReachedThreshold, like, dislike, resetSwipes, isLoaded } = useSwipeEngine();

  const [tracks, setTracks] = useState<SwipeTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const fetchMoreTracks = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      console.log('[SwipeScreen] Fetching swipe batch...');
      const newTracks = await spotifySwipeService.getSwipeBatch(accessToken);
      
      if (newTracks.length > 0) {
        setTracks((prev) => [...prev, ...newTracks]);
      } else {
        console.warn('[SwipeScreen] getSwipeBatch returned 0 tracks after all fallbacks.');
      }
    } catch (e) {
      console.warn('[SwipeScreen] Fetch tracks failed:', e);
    } finally {
      setLoading(false);
      setFetchAttempted(true);
    }
  }, [accessToken]);

  const hasFetchedInitialRef = React.useRef(false);

  useEffect(() => {
    if (accessToken && tracks.length === 0 && !hasFetchedInitialRef.current) {
      hasFetchedInitialRef.current = true;
      fetchMoreTracks();
    }
  }, [accessToken, fetchMoreTracks, tracks.length]);

  // Handle Radar Unlock Redirect
  useEffect(() => {
    if (hasReachedThreshold) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        router.replace('/(main)/radar');
      }, 3000);
    }
  }, [hasReachedThreshold, router]);

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (tracks.length === 0) return;
    const currentTrack = tracks[0];

    // Remove the top track
    setTracks((prev) => prev.slice(1));
    
    // Register swipe in engine
    if (direction === 'right') {
      await like(currentTrack.id);
    } else {
      await dislike(currentTrack.id);
    }

    // Fetch more if running low
    if (tracks.length < 5) {
      fetchMoreTracks();
    }
  };

  if (!isLoaded || (loading && tracks.length === 0 && !hasReachedThreshold)) {
    return (
      <Container style={{ justifyContent: 'center', alignItems: 'center' }}>
        <BackgroundGradient
          colors={['#181818', '#2a1a3a', '#181818']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <ActivityIndicator size="large" color="#F366FF" />
        <Text style={{ color: '#fff', marginTop: 10, fontFamily: 'Inter_500Medium' }}>Preparando tracks...</Text>
      </Container>
    );
  }

  // Only show empty state AFTER fetch has been attempted at least once
  if (fetchAttempted && tracks.length === 0 && !loading && !hasReachedThreshold) {
    return (
      <Container style={{ justifyContent: 'center', alignItems: 'center' }}>
        <BackgroundGradient
          colors={['#181818', '#2a1a3a', '#181818']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <Ionicons name="musical-notes-outline" size={64} color="rgba(243,102,255,0.5)" />
        <Text style={{ color: '#fff', marginTop: 16, fontFamily: 'GolosText_700Bold', fontSize: 18, textAlign: 'center', paddingHorizontal: 40 }}>
          Tu Spotify necesita más historial
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 }}>
          Escucha más música y vuelve 🎵
        </Text>
        <TouchableOpacity
          onPress={() => { setFetchAttempted(false); hasFetchedInitialRef.current = false; fetchMoreTracks(); }}
          style={{ marginTop: 24, backgroundColor: 'rgba(243,102,255,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: '#F366FF' }}
        >
          <Text style={{ color: '#F366FF', fontFamily: 'Inter_500Medium' }}>Reintentar</Text>
        </TouchableOpacity>
      </Container>
    );
  }

  if (hasReachedThreshold) {
    return (
      <EpicModalContainer>
        <BackgroundGradient
          colors={['#181818', '#2a1a3a', '#181818']}
        />
        <Ionicons name="planet-outline" size={120} color="#F366FF" />
        <EpicTitle>¡RADAR{'\n'}DESBLOQUEADO!</EpicTitle>
        <TouchableOpacity onPress={resetSwipes} style={{ marginTop: 40, padding: 10, borderWidth: 1, borderColor: '#555', borderRadius: 8 }}>
           <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium' }}>⚙️ Reset Swipes (Debug)</Text>
        </TouchableOpacity>
      </EpicModalContainer>
    );
  }

  return (
    <Container>
      <BackgroundGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StyledSafeArea>
        <Header>
          <ProfileSmall>
            <Ionicons name="person" size={20} color="#FFF" />
          </ProfileSmall>
          <TitleContainer>
            <HeaderTitle>Sound-Swipe</HeaderTitle>
            <HeaderSubtitle>Discover</HeaderSubtitle>
          </TitleContainer>
          <TouchableOpacity onPress={resetSwipes} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </Header>

        {tracks.length === 0 ? (
           <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
             <ActivityIndicator size="large" color="#F366FF" />
             <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium', marginTop: 10 }}>Cargando más canciones...</Text>
           </View>
        ) : (
           <SwipeStack tracks={tracks} onSwipe={handleSwipe} />
        )}

        <ProgressFooter 
          swipesCount={swipesCount} 
          threshold={SWIPE_THRESHOLD} 
          onUnlockClick={() => router.replace('/(main)/radar')} 
        />
      </StyledSafeArea>
    </Container>
  );
}
