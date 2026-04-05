import React from 'react';
import { View } from 'react-native';

const TOTAL = 6;

export function OnboardingFlowDots({ activeStep }: { activeStep: 1 | 2 }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
      {Array.from({ length: TOTAL }, (_, i) => {
        const n = i + 1;
        const done = n < activeStep;
        const current = n === activeStep;
        return (
          <View
            key={n}
            style={{
              width: current ? 22 : done ? 8 : 6,
              height: 6,
              borderRadius: 99,
              marginHorizontal: 3,
              backgroundColor: current
                ? '#F366FF'
                : done
                  ? 'rgba(243, 102, 255, 0.45)'
                  : 'rgba(255, 255, 255, 0.12)',
            }}
          />
        );
      })}
    </View>
  );
}
