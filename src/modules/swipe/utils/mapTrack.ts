import type { NextTrack } from '@/clients/encorely/types';
import type { SwipeTrack } from '@/clients/spotify/swipeFeed';

export function mapNextTrackToSwipeTrack(track: NextTrack): SwipeTrack {
  return {
    id: track.spotifyId,
    name: track.name,
    artistName: track.artist,
    imageUrl: '',
    previewUrl: track.previewUrl || null,
  };
}
