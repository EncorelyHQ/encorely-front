import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SpotifyTrack } from '../services/spotifyService';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

interface SwipeCardProps {
  track: SpotifyTrack;
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

  // ── Audio Preview Management ──
  useEffect(() => {
    let currentSound: Audio.Sound | null = null;
    
    // Solo auto-play si es la carta frontal y tiene preview
    if (isFront && track.preview_url) {
      const loadAudio = async () => {
        try {
          // Configure audio mode to play even in silent mode (iOS)
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });

          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: track.preview_url! },
            { shouldPlay: true, isLooping: true }
          );
          currentSound = newSound;
          setSound(newSound);
          setIsPlaying(true);
        } catch (e) {
          console.warn('[SwipeCard] Audio load error:', e);
        }
      };
      loadAudio();
    }

    return () => {
      // Cleanup cleanup
      if (currentSound) {
        currentSound.stopAsync().then(() => currentSound?.unloadAsync());
      }
    };
  }, [isFront, track.preview_url]);

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
        
        // Throw off screen
        translateX.value = withSpring(Math.sign(event.translationX) * width * 1.5, {
          velocity: event.velocityX,
        });
        
        // Trigger callback to parent
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(onSwipe)(direction);
      } else {
        // Return to center
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
          <Image source={{ uri: track.album.images[0]?.url }} style={styles.image} />
          
          <Animated.View style={[styles.stamp, styles.stampLike, likeOpacity]}>
            <Text style={styles.stampTextLike}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, nopeOpacity]}>
            <Text style={styles.stampTextNope}>NOPE</Text>
          </Animated.View>
          
          <View style={styles.infoContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{track.name}</Text>
              <Text style={styles.artist} numberOfLines={1}>{track.artists.map(a => a.name).join(', ')}</Text>
            </View>
            
            {track.preview_url && (
              <TouchableOpacity style={styles.playButton} onPress={togglePlay}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>

          {!track.preview_url && (
             <View style={styles.noPreviewBadge}>
               <Text style={styles.noPreviewText}>Sin Audio</Text>
             </View>
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
    borderRadius: 20,
    backgroundColor: '#1E1E28',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', 
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  artist: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '600',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(29, 185, 84, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  stamp: {
    position: 'absolute',
    top: 50,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 4,
    borderRadius: 10,
  },
  stampLike: {
    left: 40,
    borderColor: '#1DB954',
    transform: [{ rotate: '-15deg' }],
  },
  stampTextLike: {
    color: '#1DB954',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  stampNope: {
    right: 40,
    borderColor: '#E22134',
    transform: [{ rotate: '15deg' }],
  },
  stampTextNope: {
    color: '#E22134',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  noPreviewBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  noPreviewText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
