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

export default function OnboardingStep4Screen() {
  const router = useRouter();

  return (
    <ScreenShell centerContent gradientOpacity={0.75} edges={['top', 'left', 'right', 'bottom']}>
      <BackBtn onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </BackBtn>
      <Wrap>
        <SpotifyConnectCard
          tag="YA TENÉS CUENTA"
          title="Iniciá sesión con Spotify"
          body="Es el mismo inicio de sesión: recuperamos tu perfil y seguís con gustos y swipes."
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
        Paso 4 de 6
      </Text>
    </ScreenShell>
  );
}
