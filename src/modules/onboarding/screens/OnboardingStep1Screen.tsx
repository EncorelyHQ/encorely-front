import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenShell } from '@/layout';

const Hero = styled.Text`
  color: #fff;
  font-size: 36px;
  font-family: 'GolosText_900Black';
  text-align: center;
  margin-bottom: 16px;
  padding-horizontal: 24px;
`;

const Sub = styled.Text`
  color: rgba(255, 255, 255, 0.65);
  font-size: 16px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 24px;
  padding-horizontal: 32px;
  margin-bottom: 40px;
`;

const PrimaryBtn = styled.TouchableOpacity`
  background-color: #f366ff;
  padding-horizontal: 48px;
  padding-vertical: 16px;
  border-radius: 99px;
  margin-bottom: 16px;
`;

const PrimaryTxt = styled.Text`
  color: #fff;
  font-size: 16px;
  font-family: 'GolosText_700Bold';
`;

const Emoji = styled.Text`
  font-size: 56px;
  margin-bottom: 24px;
`;

export default function OnboardingStep1Screen() {
  const router = useRouter();

  return (
    <ScreenShell centerContent gradientOpacity={0.75} edges={['top', 'left', 'right', 'bottom']}>
      <LinearGradient
        colors={['transparent', 'rgba(168,85,247,0.12)', 'transparent']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '25%',
          height: 280,
        }}
      />
      <Emoji>🎵</Emoji>
      <Hero>Bienvenido a Encorely</Hero>
      <Sub>
        Conecta tu música, descubre tu vibe y encuentra personas que escuchan como vos.
      </Sub>
      <PrimaryBtn onPress={() => router.push('/(onboarding)/step-2')}>
        <PrimaryTxt>Siguiente</PrimaryTxt>
      </PrimaryBtn>
      <Text
        style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
        }}
      >
        Paso 1 de 6
      </Text>
    </ScreenShell>
  );
}
