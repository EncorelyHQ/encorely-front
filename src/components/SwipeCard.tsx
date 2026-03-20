import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import styled from 'styled-components/native';
import { SwipeTrack } from '../services/spotifySwipeService';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

// Styled Components
const GlassOverlay = styled(BlurView)`
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 24px;
  padding-top: 32px;
  flex-direction: row;
  align-items: flex-end;
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  overflow: hidden;
`;

const TrackInfoContainer = styled.View`
  flex: 1;
`;

const TrackTitle = styled.Text`
  color: #FFFFFF;
  font-size: 28px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBlack};
  margin-bottom: 4px;
  text-shadow-color: rgba(0,0,0,0.5);
  text-shadow-radius: 10px;
`;

const TrackArtist = styled.Text`
  color: ${({ theme }: any) => theme.colors.primary};
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  text-shadow-color: rgba(0,0,0,0.5);
  text-shadow-radius: 4px;
`;

const PlayButton = styled.TouchableOpacity`
  width: 60px;
  height: 60px;
  border-radius: 30px;
  background-color: ${({ theme }: any) => theme.colors.primary};
  justify-content: center;
  align-items: center;
  margin-left: 16px;
  elevation: 8;
  shadow-color: ${({ theme }: any) => theme.colors.primary};
  shadow-offset: 0px 4px;
  shadow-opacity: 0.6;
  shadow-radius: 12px;
`;

const NoPreviewBadge = styled(BlurView)`
  position: absolute;
  top: 24px;
  right: 24px;
  padding-horizontal: 12px;
  padding-vertical: 6px;
  border-radius: 99px;
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.glassLight};
  background-color: ${({ theme }: any) => theme.colors.glassDark};
  overflow: hidden;
`;

const NoPreviewText = styled.Text`
  color: #FFF;
  font-size: 11px;
  font-family: 'Inter_500Medium';
`;

const ProgressBarContainer = styled.View`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  overflow: hidden;
`;

const SoundWaveContainer = styled.View`
  flex-direction: row;
  height: 20px;
  width: 20px;
  align-items: center;
  justify-content: space-between;
  margin-left: 10px;
`;

const AnimatedBar = Animated.View;

function SoundWave({ isPlaying }: { isPlaying: boolean }) {
  const bars = [useSharedValue(4), useSharedValue(4), useSharedValue(4)];

  useEffect(() => {
    if (isPlaying) {
      bars.forEach((bar, index) => {
        bar.value = withRepeat(
          withSequence(
            withTiming(20, { duration: 300 + index * 100 }),
            withTiming(4, { duration: 300 + index * 100 })
          ),
          -1,
          true
        );
      });
    } else {
      bars.forEach(bar => {
        bar.value = withTiming(4, { duration: 300 });
      });
    }
  }, [isPlaying]);

  return (
    <SoundWaveContainer>
      {bars.map((bar, index) => {
        const animatedStyle = useAnimatedStyle(() => ({
          height: bar.value,
        }));
        return (
          <AnimatedBar
            key={index}
            style={[
              { width: 4, backgroundColor: '#F366FF', borderRadius: 2, shadowColor: '#F366FF', shadowRadius: 4, shadowOpacity: 0.8 },
              animatedStyle,
            ]}
          />
        );
      })}
    </SoundWaveContainer>
  );
}

interface SwipeCardProps {
  track: SwipeTrack;
  isFront: boolean;
  onSwipe: (direction: 'left' | 'right') => void;
}

export function SwipeCard({ track, isFront, onSwipe }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const soundRef = useRef<Audio.Sound | null>(null);

  // Helper to stop and unload audio cleanly
  const stopAndUnload = useCallback(async () => {
    const s = soundRef.current;
    if (s) {
      try {
        await s.stopAsync();
        await s.unloadAsync();
      } catch (_) {}
      soundRef.current = null;
      setSound(null);
      setIsPlaying(false);
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    let currentSound: Audio.Sound | null = null;
    
    if (isFront && track.previewUrl) {
      const loadAudio = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: track.previewUrl! },
            { shouldPlay: true, isLooping: false, progressUpdateIntervalMillis: 250 }
          );
          currentSound = newSound;
          soundRef.current = newSound;
          setSound(newSound);
          setIsPlaying(true);

          // Track playback progress
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              if (status.durationMillis && status.durationMillis > 0) {
                setProgress(status.positionMillis / status.durationMillis);
              }
              if (status.didJustFinish) {
                setIsPlaying(false);
                setProgress(1);
              }
            }
          });
        } catch (e) {
          console.warn('[SwipeCard] Audio load error:', e);
        }
      };
      loadAudio();
    }

    return () => {
      if (currentSound) {
        currentSound.stopAsync().then(() => currentSound?.unloadAsync()).catch(() => {});
      }
    };
  }, [isFront, track.previewUrl]);

  const togglePlay = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  // ── Gestures & Animations (Reanimated v3) ──
  const pan = Gesture.Pan()
    .enabled(isFront)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        
        translateX.value = withSpring(Math.sign(event.translationX) * width * 1.5, {
          velocity: event.velocityX,
        });
        
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(stopAndUnload)();
        runOnJS(onSwipe)(direction);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-width / 2, 0, width / 2], [-15, 0, 15]) + 'deg';
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, width / 4], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-width / 4, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <Animated.Image source={{ uri: track.imageUrl }} style={styles.image} />
          
          <LinearGradient
            colors={['transparent', '#2a1a3a', '#181818']}
            style={StyleSheet.absoluteFillObject}
            locations={[0.4, 0.8, 1]}
          />

          <Animated.View style={[styles.stamp, styles.stampLike, likeOpacity]}>
            <Ionicons name="sparkles" size={60} color="#F366FF" />
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, nopeOpacity]}>
            <Ionicons name="close-circle" size={60} color="#ef4444" />
          </Animated.View>
          
          <GlassOverlay intensity={60} tint="dark">
             <TrackInfoContainer>
                <TrackTitle numberOfLines={2}>{track.name}</TrackTitle>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TrackArtist numberOfLines={1}>{track.artistName}</TrackArtist>
                  {track.previewUrl && <SoundWave isPlaying={isPlaying} />}
                </View>
             </TrackInfoContainer>

             {track.previewUrl && (
               <PlayButton onPress={togglePlay}>
                 <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 4 }} />
               </PlayButton>
             )}
          </GlassOverlay>

          {!track.previewUrl && (
             <NoPreviewBadge intensity={40} tint="dark">
               <NoPreviewText>Sin preview disponible</NoPreviewText>
             </NoPreviewBadge>
          )}

          {/* Audio Progress Bar */}
          {track.previewUrl && (
            <ProgressBarContainer>
              <Animated.View
                style={{
                  height: '100%',
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: '#F366FF',
                  borderRadius: 2,
                  shadowColor: '#F366FF',
                  shadowOpacity: 0.8,
                  shadowRadius: 4,
                }}
              />
            </ProgressBarContainer>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    height: '100%',
    width: '100%',
    borderRadius: 32,
    backgroundColor: '#1E1E28',
    elevation: 10,
    shadowColor: '#F366FF',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  stamp: {
    position: 'absolute',
    top: 60,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  stampLike: {
    left: 40,
    borderColor: '#F366FF',
    transform: [{ rotate: '-15deg' }],
  },
  stampTextLike: {
    color: '#F366FF',
    fontSize: 40,
    fontFamily: 'Inter_900Black',
    letterSpacing: 2,
    textShadowColor: 'rgba(243, 102, 255, 0.5)',
    textShadowRadius: 10,
  },
  stampNope: {
    right: 40,
    borderColor: '#A855F7',
    transform: [{ rotate: '15deg' }],
  },
  stampTextNope: {
    color: '#A855F7',
    fontSize: 40,
    fontFamily: 'Inter_900Black',
    letterSpacing: 2,
    textShadowColor: 'rgba(168, 85, 247, 0.5)',
    textShadowRadius: 10,
  },
});
