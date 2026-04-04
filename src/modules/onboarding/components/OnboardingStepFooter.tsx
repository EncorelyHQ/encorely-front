import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled from 'styled-components/native';

const PrimaryTxt = styled.Text`
  color: #fff;
  font-size: 16px;
  font-family: 'GolosText_700Bold';
`;

const HintBelow = styled.Text`
  width: 100%;
  color: rgba(255, 255, 255, 0.48);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 18px;
  margin-top: 10px;
  padding-horizontal: 8px;
`;

const StepLabel = styled.Text`
  width: 100%;
  color: rgba(255, 255, 255, 0.35);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  text-align: center;
`;

const PrimaryBtn = styled.TouchableOpacity`
  width: 100%;
  background-color: #f366ff;
  padding-vertical: 16px;
  border-radius: 99px;
  align-items: center;
  margin-bottom: 14px;
  shadow-color: #f366ff;
  shadow-offset: 0px 6px;
  shadow-opacity: 0.35;
  shadow-radius: 16px;
  elevation: 8;
`;

type StepNum = 1 | 2 | 3 | 4 | 5 | 6;

export function OnboardingStepFooter({
  step,
  onNext,
  label = 'Siguiente',
  hintBelow,
}: {
  step: StepNum;
  onNext: () => void;
  label?: string;
  /** Microcopy que refuerza que el flujo es corto y termina en la app. */
  hintBelow?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        width: '100%',
        paddingHorizontal: 24,
        paddingTop: 18,
        paddingBottom: Math.max(insets.bottom, 24),
        alignItems: 'center',
      }}
    >
      <PrimaryBtn onPress={onNext} activeOpacity={0.88}>
        <PrimaryTxt>{label}</PrimaryTxt>
      </PrimaryBtn>
      <StepLabel>Paso {step} de 6</StepLabel>
      {hintBelow ? <HintBelow>{hintBelow}</HintBelow> : null}
    </View>
  );
}
