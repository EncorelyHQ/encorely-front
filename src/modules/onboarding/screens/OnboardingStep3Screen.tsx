import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { ScreenShell } from '@/layout';
import { Ionicons } from '@expo/vector-icons';
import { SpotifyConnectCard } from '@/modules/onboarding/components/SpotifyConnectCard';

const BackBtn = styled.TouchableOpacity`
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 12px;
  z-index: 2;
`;

const Wrap = styled.View`
  width: 100%;
  padding-horizontal: 24px;
  max-width: 400px;
`;

export default function OnboardingStep3Screen() {
  const router = useRouter();

  return (
    <ScreenShell centerContent gradientOpacity={0.75} edges={['top', 'left', 'right', 'bottom']}>
      <BackBtn onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </BackBtn>
      <Wrap>
        <SpotifyConnectCard
          tag="NUEVO AQUÍ"
          title="Creá tu cuenta con Spotify"
          body="Un solo tap para vincular tu cuenta. Después elegís artistas y géneros para personalizar el descubrimiento."
        />
      </Wrap>
      <Text
        style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
          marginTop: 20,
        }}
      >
        Paso 3 de 6
      </Text>
    </ScreenShell>
  );
}
