import { View, ActivityIndicator } from 'react-native';
import { ScreenShell } from '@/layout';

/**
 * Spotify OAuth redirect target on web (`makeRedirectUri({ path: 'spotify-callback' })`).
 * Token exchange runs in SpotifyAuthProvider; this screen is only visible briefly.
 */
export default function SpotifyOAuthCallbackScreen() {
  return (
    <ScreenShell centerContent gradientOpacity={0.6} edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#F366FF" size="large" />
      </View>
    </ScreenShell>
  );
}
