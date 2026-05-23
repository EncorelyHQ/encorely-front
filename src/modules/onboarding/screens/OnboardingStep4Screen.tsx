import React from 'react';
import { Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { ScreenShell } from '@/layout';
import { SpotifyConnectCard } from '@/modules/onboarding/components/SpotifyConnectCard';

const Wrap = styled.View`
  width: 100%;
  max-width: 400px;
  padding-horizontal: 24px;
  padding-top: 8px;
  padding-bottom: 16px;
  align-self: center;
  align-items: stretch;
`;

export default function OnboardingStep4Screen() {
  const router = useRouter();

  return (
    <ScreenShell
      centerContent={false}
      gradientOpacity={0.75}
      edges={['top', 'left', 'right', 'bottom']}
      topContentGap={8}
    >
      <ScrollView
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: 32,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            marginTop: 16,
            textAlign: 'center',
            paddingHorizontal: 24,
          }}
        >
          Paso 4 de 6
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}
