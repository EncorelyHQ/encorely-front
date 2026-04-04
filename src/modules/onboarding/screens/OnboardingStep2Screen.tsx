import React, { useEffect, useRef } from 'react';
import { View, ScrollView, Animated, Easing, Text } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenShell } from '@/layout';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStepFooter } from '@/modules/onboarding/components/OnboardingStepFooter';
import { OnboardingFlowDots } from '@/modules/onboarding/components/OnboardingFlowDots';
import { OnboardingScreenHeader } from '@/modules/onboarding/components/OnboardingScreenHeader';

const Root = styled.View`
  flex: 1;
  width: 100%;
  align-items: stretch;
`;

const Sub = styled.Text`
  width: 100%;
  color: rgba(255, 255, 255, 0.72);
  font-size: 15px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 23px;
  padding-horizontal: 8px;
  margin-bottom: 8px;
`;

const Teaser = styled.Text`
  width: 100%;
  color: rgba(243, 102, 255, 0.9);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  text-align: center;
  margin-bottom: 26px;
`;

const Card = styled(BlurView)`
  width: 100%;
  max-width: 340px;
  border-radius: 20px;
  padding-vertical: 18px;
  padding-horizontal: 18px;
  overflow: hidden;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.22);
  margin-bottom: 12px;
  background-color: rgba(0, 0, 0, 0.25);
`;

const CardIconWrap = styled.View`
  width: 44px;
  height: 44px;
  border-radius: 22px;
  background-color: rgba(243, 102, 255, 0.15);
  align-items: center;
  justify-content: center;
  align-self: center;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.25);
`;

const CardTitle = styled.Text`
  width: 100%;
  color: #fff;
  font-size: 15px;
  font-family: 'GolosText_700Bold';
  text-align: center;
  margin-bottom: 6px;
`;

const CardBody = styled.Text`
  width: 100%;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 19px;
`;

export default function OnboardingStep2Screen() {
  const router = useRouter();
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 580,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro]);

  return (
    <ScreenShell
      centerContent={false}
      gradientOpacity={0.55}
      edges={['top', 'left', 'right']}
      topContentGap={8}
    >
      <Root>
        <LinearGradient
          colors={['rgba(243,102,255,0.14)', 'transparent']}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 220 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(168,85,247,0.2)', 'rgba(24,24,24,0.95)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 340 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 24,
            width: '100%',
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 400,
              alignSelf: 'center',
              alignItems: 'stretch',
              opacity: intro,
              transform: [
                {
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            }}
          >
            <OnboardingScreenHeader onBack={() => router.back()} />
            <View style={{ marginBottom: 20 }}>
              <OnboardingFlowDots activeStep={2} />
            </View>

            <Text
              style={{
                width: '100%',
                textAlign: 'center',
                marginBottom: 12,
                fontSize: 30,
                fontFamily: 'GolosText_900Black',
                lineHeight: 36,
              }}
            >
              <Text style={{ color: '#fff' }}>Tu Music </Text>
              <Text
                style={{
                  color: '#f366ff',
                  textShadowColor: 'rgba(243, 102, 255, 0.45)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 10,
                }}
              >
                DNA
              </Text>
            </Text>
            <Sub>
              Traducimos lo que escuchás en un perfil musical vivo: energía, baile, ánimo y ritmo. Es
              la base para recomendaciones y para encontrar tu gente.
            </Sub>
            <Teaser>Siguiente: conectás Spotify y seguís el camino hasta el swipe.</Teaser>

            <View style={{ alignItems: 'center', width: '100%' }}>
              <Card intensity={45} tint="dark">
                <CardIconWrap>
                  <Ionicons name="pulse-outline" size={22} color="#F366FF" />
                </CardIconWrap>
                <CardTitle>Tu huella sonora</CardTitle>
                <CardBody>
                  Medimos energy, danceability, valencia y tempo a partir de tu historial reciente.
                </CardBody>
              </Card>
              <Card intensity={45} tint="dark">
                <CardIconWrap>
                  <Ionicons name="people-outline" size={22} color="#F366FF" />
                </CardIconWrap>
                <CardTitle>Matches con sentido</CardTitle>
                <CardBody>
                  Personas con un vibe parecido al tuyo — no solo “misma playlist genérica”.
                </CardBody>
              </Card>
              <Card intensity={45} tint="dark">
                <CardIconWrap>
                  <Ionicons name="lock-closed-outline" size={22} color="#F366FF" />
                </CardIconWrap>
                <CardTitle>Privacidad</CardTitle>
                <CardBody>No guardamos playlists privadas. Solo lo necesario para tu perfil.</CardBody>
              </Card>
            </View>
          </Animated.View>
        </ScrollView>
        <OnboardingStepFooter
          step={2}
          label="Siguiente"
          hintBelow="Cada paso te acerca al feed y al radar. Dale que falta poco."
          onNext={() => router.push('/(onboarding)/step-3')}
        />
      </Root>
    </ScreenShell>
  );
}
