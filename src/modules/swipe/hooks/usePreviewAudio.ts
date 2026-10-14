import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export function usePreviewAudio(previewUrl: string | null | undefined, isFront: boolean) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const stopAndUnload = useCallback(() => {
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      player.pause();
      player.remove();
    }
    setIsPlaying(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    if (!isFront || !previewUrl) return;

    let cancelled = false;
    let player: AudioPlayer;
    try {
      player = createAudioPlayer({ uri: previewUrl }, { updateInterval: 250 });
    } catch {
      return;
    }
    playerRef.current = player;
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (cancelled || playerRef.current !== player) return;
      setIsPlaying(status.playing && !status.didJustFinish);
      if (status.duration > 0) {
        setProgress(status.didJustFinish ? 1 : Math.min(1, status.currentTime / status.duration));
      }
    });

    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).then(() => {
      if (!cancelled && playerRef.current === player) player.play();
    }).catch(() => {
      if (!cancelled && playerRef.current === player) stopAndUnload();
    });

    return () => {
      cancelled = true;
      subscription.remove();
      if (playerRef.current === player) {
        playerRef.current = null;
        player.pause();
        player.remove();
      }
    };
  }, [isFront, previewUrl, stopAndUnload]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player || !player.isLoaded) return;
    if (player.playing) player.pause();
    else player.play();
  }, []);

  return { isPlaying, progress, stopAndUnload, togglePlay };
}
