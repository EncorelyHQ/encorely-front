import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/shared/context/AuthContext';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { useVibeVector } from '@/shared/hooks/useVibeVector';
import type { VibeVector } from '@/shared/types/vibe';

// ─── Styled Components ────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }: any) => theme.colors.background};
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
`;

const ContentScroller = styled.ScrollView.attrs({
  contentContainerStyle: { padding: 22, paddingTop: 10, gap: 20, paddingBottom: 110 },
})``;

// Header
const HeaderContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const AvatarImg = styled.Image`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: ${({ theme }: any) => theme.colors.surface};
`;

const AvatarPlaceholder = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #ffdcb5;
  align-items: center;
  justify-content: center;
`;

const AvatarInitial = styled.Text`
  font-size: 20px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBlack};
  color: #181818;
`;

const HeaderTextContainer = styled.View`
  justify-content: center;
`;

const UserName = styled.Text`
  font-size: 20px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.text};
`;

const RankPill = styled.View`
  background-color: ${({ theme }: any) => theme.colors.glassNeon};
  border-radius: 99px;
  padding-horizontal: 8px;
  padding-vertical: 2px;
  align-self: flex-start;
  margin-top: 2px;
`;

const RankText = styled.Text`
  font-size: 11px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyMedium};
  color: ${({ theme }: any) => theme.colors.primary};
`;

const SettingsBtn = styled.TouchableOpacity`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  background-color: ${({ theme }: any) => theme.colors.glassLight};
  align-items: center;
  justify-content: center;
`;

// Glass Card Base
const GlassCard = styled(BlurView)`
  border-radius: 32px;
  padding: 24px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.glassLight};
  background-color: ${({ theme }: any) => theme.colors.glassDark};
`;

// Music DNA Section
const DNATitle = styled.Text`
  font-size: 24px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.text};
  margin-bottom: 24px;
`;

const DNADescription = styled.Text`
  font-size: 14px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.body};
  color: ${({ theme }: any) => theme.colors.textDim};
  text-align: center;
  line-height: 22px;
  margin-top: 24px;
  margin-bottom: 20px;
`;

const ChipsContainer = styled.View`
  flex-direction: row;
  justify-content: center;
  gap: 10px;
`;

const VibeChip = styled.View`
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.glassNeon};
  border-radius: 99px;
  padding-horizontal: 16px;
  padding-vertical: 8px;
  background-color: ${({ theme }: any) => theme.colors.glassNeon};
`;

const VibeChipText = styled.Text`
  color: ${({ theme }: any) => theme.colors.primary};
  font-size: 13px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyMedium};
`;

// Stats bars
const SectionTitle = styled.Text`
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.text};
  margin-bottom: 16px;
`;

const VibeBarContainer = styled.View`
  margin-bottom: 16px;
`;

const VibeLabel = styled.Text`
  color: rgba(255, 255, 255, 0.7);
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyMedium};
  font-size: 12px;
  margin-bottom: 6px;
`;

const BarBg = styled.View`
  width: 100%;
  height: 8px;
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
`;

// Spotify connection
const SpotifyStatusContainer = styled.View`
  flex-direction: row;
  gap: 12px;
  align-items: center;
`;

const SpotifyLogoWrap = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #1db954;
  align-items: center;
  justify-content: center;
`;

const SpotifyStatusText = styled.Text`
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.text};
`;

const SpotifyStatusSub = styled.Text`
  font-size: 12px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.body};
  color: ${({ theme }: any) => theme.colors.textDim};
`;

const ActionButton = styled.TouchableOpacity`
  background-color: ${({ theme }: any) => theme.colors.glassLight};
  padding-horizontal: 16px;
  padding-vertical: 8px;
  border-radius: 99px;
`;

const ActionButtonText = styled.Text`
  color: ${({ theme }: any) => theme.colors.text};
  font-size: 13px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyMedium};
`;

// Logout button
const LogoutButton = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-vertical: 16px;
  border-radius: 99px;
  border-width: 1px;
  border-color: rgba(255, 75, 75, 0.4);
  background-color: rgba(255, 75, 75, 0.08);
`;

const LogoutText = styled.Text`
  color: #ff4b4b;
  font-size: 15px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyMedium};
`;

// ─── Radar Chart Component ────────────────────────────────────────────────────

function RealRadarChart({ vibeVector }: { vibeVector: VibeVector }) {
  const [opacity] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  if (!vibeVector) return null;

  const safeNum = (v: any, fallback = 0.5): number => {
    const n = Number(v);
    return isNaN(n) || n === null || n === undefined ? fallback : Math.max(0, Math.min(1, n));
  };

  const dimensions = [
    { label: 'Energy', value: safeNum(vibeVector.energy), color: '#F366FF' },
    { label: 'Dance', value: safeNum(vibeVector.danceability), color: '#A855F7' },
    { label: 'Valence', value: safeNum(vibeVector.valence), color: '#8B5CF6' },
    { label: 'Tempo', value: safeNum(vibeVector.tempo), color: '#EC4899' },
  ];

  const SIZE = 220;
  const CENTER = SIZE / 2;
  const MAX_R = SIZE * 0.38;

  return (
    <Animated.View style={{ opacity, alignItems: 'center', marginVertical: 10 }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <View
            key={ring}
            style={{
              position: 'absolute',
              width: MAX_R * 2 * ring,
              height: MAX_R * 2 * ring,
              borderRadius: MAX_R * ring,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          />
        ))}

        {/* Axis lines + bars */}
        {dimensions.map((dim, i) => {
          const angle = i * 90 - 90;
          const barLength = MAX_R * dim.value;

          return (
            <React.Fragment key={dim.label}>
              <View
                style={{
                  position: 'absolute',
                  width: 1,
                  height: MAX_R,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  bottom: CENTER,
                  left: CENTER - 0.5,
                  transformOrigin: 'bottom',
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 4,
                  height: barLength,
                  backgroundColor: dim.color,
                  bottom: CENTER,
                  left: CENTER - 2,
                  borderRadius: 2,
                  transformOrigin: 'bottom',
                  transform: [{ rotate: `${angle}deg` }],
                  shadowColor: dim.color,
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: dim.color,
                  left: CENTER - 4 + barLength * Math.cos((angle * Math.PI) / 180),
                  top: CENTER - 4 + barLength * Math.sin((angle * Math.PI) / 180),
                  shadowColor: dim.color,
                  shadowOpacity: 1,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Center glow dot */}
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#F366FF',
            shadowColor: '#F366FF',
            shadowOpacity: 0.8,
            shadowRadius: 10,
            elevation: 4,
          }}
        />
      </View>

      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
        {dimensions.map((dim) => (
          <View key={dim.label} style={{ alignItems: 'center' }}>
            <Text style={{ color: dim.color, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              {dim.label}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Inter_500Medium' }}>
              {Math.round(dim.value * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Vibe Bar ─────────────────────────────────────────────────────────────────

function VibeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <VibeBarContainer>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <VibeLabel>{label}</VibeLabel>
        <VibeLabel>{Math.round(value * 100)}%</VibeLabel>
      </View>
      <BarBg>
        <LinearGradient
          colors={[color, '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: '100%', width: `${value * 100}%`, borderRadius: 4 }}
        />
      </BarBg>
    </VibeBarContainer>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { user: authUser, vibeVector, logout, setSession } = useAuth();
  const { user: spotifyUser, logout: spotifyLogout, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, isLoading: isComputing } = useVibeVector();

  const displayUser = spotifyUser ?? authUser;

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await spotifyLogout();
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleSyncVibe = async () => {
    const token = await getValidToken();
    if (!token) return;
    const newVibe = await computeVibe(token);
    if (newVibe && authUser) {
      await setSession(authUser, token, newVibe);
      Alert.alert('Éxito', 'Tu Vibe Vector ha sido actualizado con tus últimas escuchas.');
    }
  };

  if (!displayUser) return null;

  return (
    <Container>
      <BackgroundGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StyledSafeArea>
        <ContentScroller showsVerticalScrollIndicator={false}>
          {/* Header */}
          <HeaderContainer>
            <HeaderLeft>
              {spotifyUser?.avatar ? (
                <AvatarImg source={{ uri: spotifyUser.avatar }} />
              ) : (
                <AvatarPlaceholder>
                  <AvatarInitial>{displayUser.name?.[0]?.toUpperCase() ?? '?'}</AvatarInitial>
                </AvatarPlaceholder>
              )}
              <HeaderTextContainer>
                <UserName>{displayUser.name.split(' ')[0]}</UserName>
                <RankPill>
                  <RankText>Vibe Explorer</RankText>
                </RankPill>
              </HeaderTextContainer>
            </HeaderLeft>
            <SettingsBtn onPress={() => router.push('/(main)/settings')}>
              <Ionicons name="settings-sharp" size={20} color="#fff" />
            </SettingsBtn>
          </HeaderContainer>

          {/* Music DNA Card */}
          <GlassCard intensity={40} tint="dark">
            <DNATitle>Tu Music DNA</DNATitle>

            {vibeVector ? (
              <View>
                <RealRadarChart vibeVector={vibeVector} />
              </View>
            ) : (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)' }}>Calculando ADN musical...</Text>
              </View>
            )}

            <DNADescription>
              Tu Music DNA se calcula basándose en tu historial de Spotify.{'\n'}
              Analizamos estos datos para encontrar tus matches musicales perfectos.
            </DNADescription>

            <ChipsContainer>
              <VibeChip><VibeChipText>Chill</VibeChipText></VibeChip>
              <VibeChip><VibeChipText>Happy</VibeChipText></VibeChip>
              <VibeChip><VibeChipText>Night Vibes</VibeChipText></VibeChip>
            </ChipsContainer>
          </GlassCard>

          {/* Stats Bars */}
          <GlassCard intensity={40} tint="dark">
            <SectionTitle>Estadísticas Musicales</SectionTitle>
            <VibeBar label="Energy" value={vibeVector?.energy ?? 0} color="#F366FF" />
            <VibeBar label="Danceability" value={vibeVector?.danceability ?? 0} color="#A855F7" />
            <VibeBar label="Valence" value={vibeVector?.valence ?? 0} color="#8B5CF6" />
            <VibeBar label="Tempo" value={vibeVector?.tempo ?? 0} color="#EC4899" />
          </GlassCard>

          {/* Spotify Connection */}
          <GlassCard
            intensity={40}
            tint="dark"
            style={{ borderRadius: 99, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <SpotifyStatusContainer>
              <SpotifyLogoWrap>
                <Ionicons name="musical-notes" size={24} color="#000" />
              </SpotifyLogoWrap>
              <View>
                <SpotifyStatusText>Conectado con{'\n'}Spotify</SpotifyStatusText>
                <SpotifyStatusSub>Última actualización: Hoy</SpotifyStatusSub>
              </View>
            </SpotifyStatusContainer>
            <ActionButton onPress={handleSyncVibe} disabled={isComputing}>
              {isComputing ? (
                <ActivityIndicator size="small" color="#F366FF" />
              ) : (
                <ActionButtonText>Actualizar</ActionButtonText>
              )}
            </ActionButton>
          </GlassCard>

          {/* Logout */}
          <LogoutButton onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF4B4B" />
            <LogoutText>Cerrar Sesión</LogoutText>
          </LogoutButton>
        </ContentScroller>
      </StyledSafeArea>
    </Container>
  );
}
