import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SwipeCard } from './SwipeCard';
import { SwipeTrack } from '../services/spotifySwipeService';

const { width } = Dimensions.get('window');

interface SwipeStackProps {
  tracks: SwipeTrack[];
  onSwipe: (direction: 'left' | 'right') => void;
}

export function SwipeStack({ tracks, onSwipe }: SwipeStackProps) {
  const visibleTracks = tracks.slice(0, 3).reverse();

  if (tracks.length === 0) return null;

  return (
    <View style={styles.container}>
      {visibleTracks.map((track, mappedIndex) => {
        const isFront = mappedIndex === visibleTracks.length - 1;
        const indexFromFront = (visibleTracks.length - 1) - mappedIndex;

        const scale = 1 - indexFromFront * 0.05;
        const translateY = indexFromFront * 15;

        return (
          <View
            key={track.id}
            style={[
              StyleSheet.absoluteFillObject,
              { 
                transform: [{ scale }, { translateY }],
                zIndex: mappedIndex
              }
            ]}
            pointerEvents={isFront ? 'auto' : 'none'}
          >
            <SwipeCard track={track} isFront={isFront} onSwipe={onSwipe} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width * 0.9,
    alignSelf: 'center',
    justifyContent: 'center',
  }
});
