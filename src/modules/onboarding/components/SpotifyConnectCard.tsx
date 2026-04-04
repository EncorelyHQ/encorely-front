import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { useRouter } from 'expo-router';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { useVibeVector } from '@/shared/hooks/useVibeVector';
import { useAuth } from '@/shared/context/AuthContext';
import { BlurView } from 'expo-blur';

const GlassCard = styled(BlurView)`
  border-radius: 24px;
  padding: 24px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.glassLight};
  background-color: ${({ theme }: any) => theme.colors.glassDark};
`;

const SectionTag = styled.Text`
  font-size: 11px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.primary};
  letter-spacing: 2px;
  margin-bottom: 12px;
  text-align: center;
`;

const Title = styled.Text`
  width: 100%;
  font-size: 28px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBlack};
  color: ${({ theme }: any) => theme.colors.text};
  text-align: center;
  margin-bottom: 12px;
`;

const Body = styled.Text`
  width: 100%;
  font-size: 15px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.body};
  color: ${({ theme }: any) => theme.colors.textDim};
  text-align: center;
  line-height: 22px;
  margin-bottom: 24px;
`;

const SpotifyButton = styled.TouchableOpacity`
  background-color: #1db954;
  border-radius: ${({ theme }: any) => theme.components.button.radiusCircle}px;
  padding-vertical: 16px;
  align-items: center;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
`;

const BtnText = styled.Text`
  color: #ffffff;
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
`;

interface SpotifyConnectCardProps {
  tag: string;
  title: string;
  body: string;
  /** Muestra una etiqueta “Recomendado” sobre el botón de Spotify. */
  showRecommendedPill?: boolean;
}

export function SpotifyConnectCard({
  tag,
  title,
  body,
  showRecommendedPill = false,
}: SpotifyConnectCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const { user, isLoggingIn, error, login, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, usedFallback } = useVibeVector();
  const { setSession } = useAuth();
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setComputing(true);
      const token = await getValidToken();
      if (!token) {
        setComputing(false);
        return;
      }
      const vibe = await computeVibe(token);
      await setSession(user, token, vibe);
      if (usedFallback) {
        Alert.alert(
          '🎵 Vibe básico activado',
          'Usando análisis de metadatos. Para mayor precisión, revisa los permisos de tu app en Spotify.',
          [{ text: 'Entendido' }]
        );
      }
      setComputing(false);
      router.replace('/(onboarding)/step-5');
    })();
  }, [user]);

  return (
    <GlassCard intensity={40} tint="dark">
      <SectionTag>{tag}</SectionTag>
      <Title>{title}</Title>
      <Body>{body}</Body>
      {error ? (
        <View
          style={{
            backgroundColor: '#7F1D1D22',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#FCA5A5',
              textAlign: 'center',
              fontFamily: theme.typography.fontFamily.body,
            }}
          >
            ⚠️ {error}
          </Text>
        </View>
      ) : null}
      {showRecommendedPill ? (
        <View
          style={{
            alignSelf: 'center',
            backgroundColor: 'rgba(243, 102, 255, 0.2)',
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 99,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(243, 102, 255, 0.45)',
          }}
        >
          <Text
            style={{
              color: '#F366FF',
              fontSize: 12,
              fontFamily: 'GolosText_700Bold',
              letterSpacing: 0.5,
            }}
          >
            Recomendado · mejor experiencia
          </Text>
        </View>
      ) : null}
      <SpotifyButton onPress={login} disabled={isLoggingIn || computing}>
        {isLoggingIn || computing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={{ color: '#fff', fontSize: 20 }}>♪</Text>
            <BtnText>Conectar con Spotify</BtnText>
          </>
        )}
      </SpotifyButton>
      {computing ? (
        <Text
          style={{
            color: theme.colors.textDim,
            textAlign: 'center',
            marginTop: 16,
            fontFamily: theme.typography.fontFamily.body,
          }}
        >
          Analizando tu perfil musical…
        </Text>
      ) : null}
    </GlassCard>
  );
}
