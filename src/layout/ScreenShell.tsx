import React from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import { LinearGradient } from 'expo-linear-gradient';

const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }: any) => theme.colors.background};
`;

const GradientLayer = styled(LinearGradient)`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
`;

export const DEFAULT_SCREEN_GRADIENT = ['#181818', '#2a1a3a', '#181818'] as const;

export type ScreenShellProps = {
  children: React.ReactNode;
  showGradient?: boolean;
  gradientOpacity?: number;
  centerContent?: boolean;
  edges?: Edge[];
};

export function ScreenShell({
  children,
  showGradient = true,
  gradientOpacity = 0.6,
  centerContent = false,
  edges = ['top', 'left', 'right'],
}: ScreenShellProps) {
  return (
    <Root>
      {showGradient && (
        <GradientLayer
          colors={[...DEFAULT_SCREEN_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ opacity: gradientOpacity }}
        />
      )}
      <SafeAreaView style={{ flex: 1, alignItems: centerContent ? 'center' : undefined }} edges={edges}>
        {children}
      </SafeAreaView>
    </Root>
  );
}
