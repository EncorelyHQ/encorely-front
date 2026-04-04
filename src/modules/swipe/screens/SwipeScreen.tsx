import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import styled from 'styled-components/native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { spotifySwipeService, type SwipeTrack } from '@/clients/spotify/swipeFeed';
import { useSwipeEngine } from '@/modules/swipe/hooks/useSwipeEngine';
import { SwipeStack } from '@/modules/swipe/components/SwipeStack';
import { ProgressFooter } from '@/modules/swipe/components/ProgressFooter';
import { ScreenShell } from '@/layout';
import {
  ONBOARDING_SWIPES_REQUIRED,
  RADAR_SWIPES_THRESHOLD,
} from '@/config/onboarding';

export type SwipeScreenMode = 'main' | 'onboarding';

interface SwipeScreenProps {
  /** main: progress toward radar (100) and navigate to radar when done. onboarding: progress toward 25 and parent handles completion. */
  mode?: SwipeScreenMode;
  /** Called when onboarding swipe count reaches ONBOARDING_SWIPES_REQUIRED (only in onboarding mode). */
  onOnboardingSwipesComplete?: () => void;
}

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
  color: #fff;
  font-size: 20px;
  font-family: 'GolosText_700Bold';
`;

const HeaderSubtitle = styled.Text`
  color: #f366ff;
  font-size: 13px;
  font-family: 'Inter_500Medium';
  margin-top: 2px;
`;

const ProfileSmall = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #a855f7;
  align-items: center;
  justify-content: center;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.2);
`;

const EpicModalContainer = styled.View`
  flex: 1;
  background-color: #181818;
  align-items: center;
  justify-content: center;
`;

const EpicTitle = styled.Text`
  color: #f366ff;
  font-size: 32px;
  font-family: 'GolosText_700Bold';
  margin-top: 24px;
  text-align: center;
  text-shadow-color: rgba(243, 102, 255, 0.5);
  text-shadow-offset: 0px 4px;
  text-shadow-radius: 20px;
`;

export default function SwipeScreen({
  mode = 'main',
  onOnboardingSwipesComplete,
}: SwipeScreenProps) {
  const router = useRouter();
  const { accessToken } = useSpotifyAuth();
  const {
    swipesCount,
    hasReachedRadarThreshold,
    hasCompletedOnboardingSwipes,
    like,
    dislike,
    resetSwipes,
    isLoaded,
  } = useSwipeEngine();

  const isOnboardingMode = mode === 'onboarding';
  const progressThreshold = isOnboardingMode
    ? ONBOARDING_SWIPES_REQUIRED
    : RADAR_SWIPES_THRESHOLD;

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

  const onboardingCompleteFired = React.useRef(false);
  const mainRadarScheduled = React.useRef(false);

  useEffect(() => {
    if (!hasReachedRadarThreshold) mainRadarScheduled.current = false;
  }, [hasReachedRadarThreshold]);

  useEffect(() => {
    if (isOnboardingMode && hasCompletedOnboardingSwipes) {
      if (onboardingCompleteFired.current) return;
      onboardingCompleteFired.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => {
        void Promise.resolve(onOnboardingSwipesComplete?.());
      }, 2000);
      return () => clearTimeout(t);
    }
    if (!isOnboardingMode && hasReachedRadarThreshold) {
      if (mainRadarScheduled.current) return;
      mainRadarScheduled.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => {
        router.replace('/(main)/radar');
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [
    isOnboardingMode,
    hasCompletedOnboardingSwipes,
    hasReachedRadarThreshold,
    onOnboardingSwipesComplete,
    router,
  ]);

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (tracks.length === 0) return;
    const currentTrack = tracks[0];

    setTracks((prev) => prev.slice(1));

    if (direction === 'right') {
      await like(currentTrack.id);
    } else {
      await dislike(currentTrack.id);
    }

    if (tracks.length < 5) {
      fetchMoreTracks();
    }
  };

  const thresholdMet = isOnboardingMode
    ? hasCompletedOnboardingSwipes
    : hasReachedRadarThreshold;

  if (!isLoaded || (loading && tracks.length === 0 && !thresholdMet)) {
    return (
      <ScreenShell centerContent gradientOpacity={0.6}>
        <ActivityIndicator size="large" color="#F366FF" />
        <Text style={{ color: '#fff', marginTop: 10, fontFamily: 'Inter_500Medium' }}>
          Preparando tracks...
        </Text>
      </ScreenShell>
    );
  }

  if (fetchAttempted && tracks.length === 0 && !loading && !thresholdMet) {
    return (
      <ScreenShell centerContent gradientOpacity={0.6}>
        <Ionicons name="musical-notes-outline" size={64} color="rgba(243,102,255,0.5)" />
        <Text
          style={{
            color: '#fff',
            marginTop: 16,
            fontFamily: 'GolosText_700Bold',
            fontSize: 18,
            textAlign: 'center',
            paddingHorizontal: 40,
          }}
        >
          Tu Spotify necesita más historial
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.5)',
            marginTop: 8,
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            textAlign: 'center',
            paddingHorizontal: 40,
          }}
        >
          Escucha más música y vuelve 🎵
        </Text>
        <TouchableOpacity
          onPress={() => {
            setFetchAttempted(false);
            hasFetchedInitialRef.current = false;
            fetchMoreTracks();
          }}
          style={{
            marginTop: 24,
            backgroundColor: 'rgba(243,102,255,0.2)',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#F366FF',
          }}
        >
          <Text style={{ color: '#F366FF', fontFamily: 'Inter_500Medium' }}>Reintentar</Text>
        </TouchableOpacity>
      </ScreenShell>
    );
  }

  if (isOnboardingMode && hasCompletedOnboardingSwipes) {
    return (
      <ScreenShell centerContent gradientOpacity={0.6} edges={['top', 'left', 'right', 'bottom']}>
        <EpicModalContainer style={{ backgroundColor: 'transparent' }}>
          <Ionicons name="checkmark-circle-outline" size={120} color="#F366FF" />
          <EpicTitle>¡ONBOARDING{'\n'}LISTO!</EpicTitle>
          <Text
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontFamily: 'Inter_500Medium',
              marginTop: 16,
              textAlign: 'center',
              paddingHorizontal: 32,
            }}
          >
            Entrando a Encorely…
          </Text>
        </EpicModalContainer>
      </ScreenShell>
    );
  }

  if (!isOnboardingMode && hasReachedRadarThreshold) {
    return (
      <ScreenShell centerContent gradientOpacity={0.6} edges={['top', 'left', 'right', 'bottom']}>
        <EpicModalContainer style={{ backgroundColor: 'transparent' }}>
          <Ionicons name="planet-outline" size={120} color="#F366FF" />
          <EpicTitle>¡RADAR{'\n'}DESBLOQUEADO!</EpicTitle>
          <TouchableOpacity
            onPress={resetSwipes}
            style={{ marginTop: 40, padding: 10, borderWidth: 1, borderColor: '#555', borderRadius: 8 }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium' }}>
              ⚙️ Reset Swipes (Debug)
            </Text>
          </TouchableOpacity>
        </EpicModalContainer>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell centerContent={false} gradientOpacity={0.6}>
      <Header>
        <TouchableOpacity onPress={() => router.push('/(main)/profile')}>
          <ProfileSmall>
            <Ionicons name="person" size={20} color="#FFF" />
          </ProfileSmall>
        </TouchableOpacity>
        <TitleContainer>
          <HeaderTitle>Sound-Swipe</HeaderTitle>
          <HeaderSubtitle>Discover</HeaderSubtitle>
        </TitleContainer>
        {!isOnboardingMode ? (
          <TouchableOpacity
            onPress={resetSwipes}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44, height: 44 }} />
        )}
      </Header>

      {tracks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#F366FF" />
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Inter_500Medium',
              marginTop: 10,
            }}
          >
            Cargando más canciones...
          </Text>
        </View>
      ) : (
        <SwipeStack tracks={tracks} onSwipe={handleSwipe} />
      )}

      <ProgressFooter
        swipesCount={swipesCount}
        threshold={progressThreshold}
        onUnlockClick={() => router.replace('/(main)/radar')}
        showRadarButton={!isOnboardingMode}
      />
    </ScreenShell>
  );
}
