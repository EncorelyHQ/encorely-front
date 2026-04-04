import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { ScreenShell } from '@/layout';
import { Ionicons } from '@expo/vector-icons';

const Title = styled.Text`
  color: #fff;
  font-size: 28px;
  font-family: 'GolosText_700Bold';
  text-align: center;
  margin-bottom: 12px;
  padding-horizontal: 20px;
`;

const Sub = styled.Text`
  color: rgba(255, 255, 255, 0.65);
  font-size: 15px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 22px;
  padding-horizontal: 28px;
  margin-bottom: 32px;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding-vertical: 12px;
  padding-horizontal: 16px;
  border-radius: 16px;
  background-color: rgba(255, 255, 255, 0.06);
  margin-bottom: 10px;
  width: 100%;
  max-width: 340px;
`;

const RowText = styled.Text`
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  font-family: 'Inter_500Medium';
  flex: 1;
`;

const PrimaryBtn = styled.TouchableOpacity`
  background-color: #f366ff;
  padding-horizontal: 48px;
  padding-vertical: 16px;
  border-radius: 99px;
  margin-top: 24px;
`;

const PrimaryTxt = styled.Text`
  color: #fff;
  font-size: 16px;
  font-family: 'GolosText_700Bold';
`;

const BackBtn = styled.TouchableOpacity`
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 12px;
`;

export default function OnboardingStep2Screen() {
  const router = useRouter();

  return (
    <ScreenShell centerContent gradientOpacity={0.75} edges={['top', 'left', 'right', 'bottom']}>
      <BackBtn onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </BackBtn>
      <Title>Tu Music DNA</Title>
      <Sub>
        Analizamos lo que escuchás para armar tu vector de vibe y recomendaciones que suenan a vos.
      </Sub>
      <View style={{ alignItems: 'center', width: '100%' }}>
        <Row>
          <Ionicons name="pulse-outline" size={22} color="#F366FF" />
          <RowText>Energy, baile, valencia y tempo a partir de tu historial</RowText>
        </Row>
        <Row>
          <Ionicons name="people-outline" size={22} color="#F366FF" />
          <RowText>Base para matches y radar social</RowText>
        </Row>
        <Row>
          <Ionicons name="lock-closed-outline" size={22} color="#F366FF" />
          <RowText>Sin guardar playlists privadas</RowText>
        </Row>
      </View>
      <PrimaryBtn onPress={() => router.push('/(onboarding)/step-3')}>
        <PrimaryTxt>Siguiente</PrimaryTxt>
      </PrimaryBtn>
      <Text
        style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
          marginTop: 16,
        }}
      >
        Paso 2 de 6
      </Text>
    </ScreenShell>
  );
}
