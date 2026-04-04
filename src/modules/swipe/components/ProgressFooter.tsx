import React, { useEffect } from 'react';
import { View } from 'react-native';
import styled from 'styled-components/native';
import * as Haptics from 'expo-haptics';

const FooterContainer = styled.View`
  width: 100%;
  padding: 24px;
  padding-bottom: 110px;
  align-items: center;
  background-color: transparent;
`;

const ProgressBarBg = styled.View`
  width: 100%;
  height: 8px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 12px;
`;

const ProgressInfoRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  align-items: center;
`;

const ProgressText = styled.Text`
  color: #fff;
  font-size: 14px;
  font-family: 'Inter_500Medium';
`;

const RadarButton = styled.TouchableOpacity<{ disabled: boolean }>`
  background-color: ${(props: any) =>
    props.disabled ? 'rgba(243, 102, 255, 0.3)' : '#F366FF'};
  padding-horizontal: 24px;
  padding-vertical: 12px;
  border-radius: 99px;
`;

const RadarButtonText = styled.Text<{ disabled: boolean }>`
  color: ${(props: any) => (props.disabled ? 'rgba(255,255,255,0.5)' : '#FFF')};
  font-family: 'GolosText_700Bold';
  font-size: 16px;
`;

const MilestoneToast = styled.View`
  position: absolute;
  top: -40px;
  background-color: #f366ff;
  padding-horizontal: 16px;
  padding-vertical: 8px;
  border-radius: 99px;
  z-index: 10;
`;

const MilestoneText = styled.Text`
  color: #fff;
  font-family: 'GolosText_700Bold';
  font-size: 14px;
`;

interface ProgressFooterProps {
  swipesCount: number;
  threshold: number;
  onUnlockClick: () => void;
  /** When false, only the progress bar is shown (e.g. onboarding step 6). */
  showRadarButton?: boolean;
}

export function ProgressFooter({
  swipesCount,
  threshold,
  onUnlockClick,
  showRadarButton = true,
}: ProgressFooterProps) {
  const [showToast, setShowToast] = React.useState(false);

  useEffect(() => {
    if (swipesCount > 0 && swipesCount % 10 === 0 && swipesCount < threshold) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [swipesCount, threshold]);

  const progress = Math.min(swipesCount / threshold, 1);
  let color = '#ef4444';
  if (progress >= 0.5) color = '#f97316';
  if (progress >= 0.8) color = '#22c55e';
  if (progress >= 1) color = '#F366FF';

  return (
    <FooterContainer>
      {showToast && (
        <MilestoneToast>
          <MilestoneText>+10 swipes!</MilestoneText>
        </MilestoneToast>
      )}
      <ProgressBarBg>
        <View
          style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: color, borderRadius: 99 }}
        />
      </ProgressBarBg>
      <ProgressInfoRow>
        <ProgressText>
          {swipesCount}/{threshold} swipes
        </ProgressText>
        {showRadarButton ? (
          <RadarButton disabled={progress < 1} onPress={onUnlockClick}>
            <RadarButtonText disabled={progress < 1}>Ver Radar</RadarButtonText>
          </RadarButton>
        ) : (
          <View style={{ minWidth: 1 }} />
        )}
      </ProgressInfoRow>
    </FooterContainer>
  );
}
