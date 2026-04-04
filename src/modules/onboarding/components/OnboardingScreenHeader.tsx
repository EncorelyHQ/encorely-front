import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HIT_SLOP = { top: 16, bottom: 16, left: 16, right: 16 };

export function OnboardingScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 6,
        minHeight: 52,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        hitSlop={HIT_SLOP}
        style={{ padding: 6 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
