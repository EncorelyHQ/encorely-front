import React, { useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/shared/context/AuthContext';
import { useSpotifyAuth } from '@/shared/context/SpotifyAuthContext';
import type { VibeVector } from '@/shared/types/vibe';
import { useRouter } from 'expo-router';
import { useSwipeEngine } from '@/modules/swipe/hooks/useSwipeEngine';
import { RADAR_SWIPES_THRESHOLD } from '@/config/onboarding';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// victory-native removed — causes 'Building 100%' hang in Expo Go

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
  contentContainerStyle: { padding: 22, paddingTop: 10, gap: 20, paddingBottom: 110 }
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
  color: #181818;3
`;

const HeaderTextContainer = styled.View`
  justify-content: center;
`;

const Greeting = styled.Text`
  font-size: 20px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.text};
`;

const SubGreetingPill = styled.View`
  background-color: ${({ theme }: any) => theme.colors.glassNeon};
  border-radius: 99px;
  padding-horizontal: 8px;
  padding-vertical: 2px;
  align-self: flex-start;
  margin-top: 2px;
`;

const SubGreetingText = styled.Text`
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

const RadarContainer = styled(GlassCard)`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
`;

const SpotifyStatusContainer = styled.View`
  flex-direction: row;
  gap: 12px;
  align-items: center;
`;

const SpotifyLogoWrap = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: #1DB954;
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
    return (isNaN(n) || n === null || n === undefined) ? fallback : Math.max(0, Math.min(1, n));
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
          const angle = (i * 90) - 90; // 0°, 90°, 180°, 270° starting from top
          const barLength = MAX_R * dim.value;

          return (
            <React.Fragment key={dim.label}>
              {/* Axis line */}
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
              {/* Value bar (glow effect) */}
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
              {/* Dot at end */}
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

// ─── Home Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user: authUser, vibeVector } = useAuth();
  const { user: spotifyUser } = useSpotifyAuth();
  const { swipesCount, hasReachedRadarThreshold } = useSwipeEngine();

  const progressPercent = Math.min((swipesCount / RADAR_SWIPES_THRESHOLD) * 100, 100);
  const displayUser = spotifyUser ?? authUser;

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
                  <AvatarInitial>
                    {displayUser.name?.[0]?.toUpperCase() ?? '?'}
                  </AvatarInitial>
                </AvatarPlaceholder>
              )}
              <HeaderTextContainer>
                <Greeting>{displayUser.name.split(' ')[0]}</Greeting>
                <SubGreetingPill>
                  <SubGreetingText>Perfil musical</SubGreetingText>
                </SubGreetingPill>
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
              Tu Music DNA se calcula basándose en tu historial de Spotify.
              Analizamos estos datos para encontrar tus matches musicales perfectos.
            </DNADescription>

            <ChipsContainer>
              <VibeChip><VibeChipText>Chill</VibeChipText></VibeChip>
              <VibeChip><VibeChipText>Happy</VibeChipText></VibeChip>
              <VibeChip><VibeChipText>Night Vibes</VibeChipText></VibeChip>
            </ChipsContainer>
          </GlassCard>

          {/* Spotify Status Connection */}
          <GlassCard intensity={40} tint="dark" style={{ borderRadius: 99, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SpotifyStatusContainer>
              <SpotifyLogoWrap>
                <Ionicons name="musical-notes" size={24} color="#000" />
              </SpotifyLogoWrap>
              <View>
                <SpotifyStatusText>Conectado con{'\n'}Spotify</SpotifyStatusText>
                <SpotifyStatusSub>Última actualización: Hoy</SpotifyStatusSub>
              </View>
            </SpotifyStatusContainer>
            <ActionButton onPress={() => { }}>
              <ActionButtonText>Actualizar</ActionButtonText>
            </ActionButton>
          </GlassCard>

          {/* Swipe/Radar Action Card */}
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(hasReachedRadarThreshold ? '/(main)/radar' : '/(main)/')}>
            <GlassCard intensity={40} tint="dark" style={{ borderColor: hasReachedRadarThreshold ? '#F366FF' : 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <SpotifyStatusText>{hasReachedRadarThreshold ? 'Radar Social Activo' : 'Sound-Swipe'}</SpotifyStatusText>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </View>
              <SpotifyStatusSub style={{ marginBottom: 16 }}>
                {hasReachedRadarThreshold
                  ? 'Descubre fans de conciertos cerca de ti con tu mismo Vibe.'
                  : `Evalúa tracks para desbloquear el radar de personas (${RADAR_SWIPES_THRESHOLD} swipes).`}
              </SpotifyStatusSub>

              <View style={{ width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#F366FF', borderRadius: 99 }} />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 8, textAlign: 'right' }}>
                {swipesCount} / {RADAR_SWIPES_THRESHOLD} swipes
              </Text>
            </GlassCard>
          </TouchableOpacity>

        </ContentScroller>
      </StyledSafeArea>
    </Container>
  );
}
