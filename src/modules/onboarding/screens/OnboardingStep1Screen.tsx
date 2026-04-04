import React, { useEffect, useRef } from 'react';
import { View, ScrollView, Text, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenShell } from '@/layout';
import { OnboardingStepFooter } from '@/modules/onboarding/components/OnboardingStepFooter';
import { OnboardingFlowDots } from '@/modules/onboarding/components/OnboardingFlowDots';

const Root = styled.View`
  flex: 1;
  width: 100%;
  align-items: stretch;
`;

const BrandPill = styled.View`
  align-self: center;
  padding-horizontal: 14px;
  padding-vertical: 6px;
  border-radius: 99px;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.45);
  background-color: rgba(243, 102, 255, 0.1);
  margin-bottom: 28px;
`;

const BrandPillText = styled.Text`
  color: #f366ff;
  font-size: 11px;
  font-family: 'GolosText_700Bold';
  letter-spacing: 2px;
`;

const Line1 = styled.Text`
  width: 100%;
  color: #ffffff;
  font-size: 34px;
  font-family: 'GolosText_900Black';
  text-align: center;
  line-height: 40px;
  letter-spacing: -0.5px;
`;

const Line2 = styled.Text`
  width: 100%;
  color: #f366ff;
  font-size: 34px;
  font-family: 'GolosText_900Black';
  text-align: center;
  line-height: 40px;
  letter-spacing: -0.5px;
  margin-bottom: 18px;
  text-shadow-color: rgba(243, 102, 255, 0.45);
  text-shadow-offset: 0px 2px;
  text-shadow-radius: 12px;
`;

const Sub = styled.Text`
  width: 100%;
  color: rgba(255, 255, 255, 0.72);
  font-size: 16px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 24px;
  padding-horizontal: 12px;
  margin-bottom: 28px;
`;

const ChipsRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
`;

const Chip = styled.View`
  padding-horizontal: 12px;
  padding-vertical: 8px;
  border-radius: 99px;
  background-color: rgba(255, 255, 255, 0.07);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.12);
  margin: 4px;
`;

const ChipText = styled.Text`
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-family: 'Inter_500Medium';
`;

const AuthLinksBlock = styled.View`
  width: 100%;
  margin-top: 28px;
  padding-horizontal: 12px;
  align-items: center;
`;

const AuthLinkPress = styled.TouchableOpacity`
  padding-vertical: 12px;
  padding-horizontal: 14px;
`;

const AuthLinkLabel = styled.Text`
  color: #f366ff;
  font-size: 15px;
  font-family: 'GolosText_700Bold';
  text-align: center;
`;

export default function OnboardingStep1Screen() {
  const router = useRouter();
  const intro = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <ScreenShell
      centerContent={false}
      gradientOpacity={0.55}
      edges={['top', 'left', 'right']}
      topContentGap={10}
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
            paddingTop: 28,
            paddingBottom: 32,
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
                    outputRange: [22, 0],
                  }),
                },
              ],
            }}
          >
            <View style={{ marginBottom: 20 }}>
              <OnboardingFlowDots activeStep={1} />
            </View>

            <BrandPill>
              <BrandPillText>ENCORELY</BrandPillText>
            </BrandPill>

            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Animated.View
                style={{
                  transform: [{ scale: pulse }],
                  borderRadius: 999,
                  padding: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(243, 102, 255, 0.35)',
                  backgroundColor: 'rgba(243, 102, 255, 0.08)',
                }}
              >
                <LinearGradient
                  colors={['rgba(243,102,255,0.25)', 'rgba(168,85,247,0.15)']}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 48, lineHeight: 56 }}>🎵</Text>
                </LinearGradient>
              </Animated.View>
            </View>

            <Line1>No vayas solo</Line1>
            <Line2>a tu próximo show</Line2>
            <Sub>
              Conectá tu música, descubrí tu vibe y encontrá personas que escuchan como vos. Todo el
              recorrido termina acá, en la app.
            </Sub>
            <ChipsRow>
              <Chip>
                <ChipText>Swipe real</ChipText>
              </Chip>
              <Chip>
                <ChipText>Matches por vibe</ChipText>
              </Chip>
              <Chip>
                <ChipText>Radar social</ChipText>
              </Chip>
            </ChipsRow>

            <AuthLinksBlock>
              <AuthLinkPress
                onPress={() => router.push('/(auth)/login')}
                accessibilityRole="button"
                accessibilityLabel="Iniciar sesión"
                activeOpacity={0.75}
              >
                <AuthLinkLabel>Entrar</AuthLinkLabel>
              </AuthLinkPress>
            </AuthLinksBlock>
          </Animated.View>
        </ScrollView>
        <OnboardingStepFooter
          step={1}
          label="Empezar"
          hintBelow="Solo 6 pasos — en un par de minutos ya estás adentro."
          onNext={() => router.push('/(onboarding)/step-2')}
        />
      </Root>
    </ScreenShell>
  );
}
