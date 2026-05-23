import React, { useState } from 'react';
import { Text, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { ScreenShell } from '@/layout';
import { Ionicons } from '@expo/vector-icons';
import { SpotifyConnectCard } from '@/modules/onboarding/components/SpotifyConnectCard';

const Wrap = styled.View`
  width: 100%;
  max-width: 400px;
  padding-horizontal: 24px;
  padding-top: 8px;
  padding-bottom: 8px;
  align-self: center;
  align-items: stretch;
`;

const DividerRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-vertical: 22px;
`;

const DividerLine = styled.View`
  flex: 1;
  height: 1px;
  background-color: rgba(255, 255, 255, 0.12);
`;

const DividerText = styled.Text`
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-horizontal: 14px;
`;

const SectionLabel = styled.Text`
  width: 100%;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  margin-bottom: 10px;
  text-align: center;
`;

const Input = styled.TextInput`
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding-horizontal: 14px;
  padding-vertical: 14px;
  color: #fff;
  font-size: 15px;
  font-family: 'Inter_500Medium';
  margin-bottom: 10px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
`;

const EmailButton = styled.TouchableOpacity`
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  padding-vertical: 14px;
  align-items: center;
  margin-top: 6px;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.15);
`;

const EmailButtonText = styled.Text`
  color: #fff;
  font-size: 15px;
  font-family: 'GolosText_600SemiBold';
`;

const GoogleButton = styled.TouchableOpacity`
  background-color: #fff;
  border-radius: 99px;
  padding-vertical: 14px;
  align-items: center;
  flex-direction: row;
  justify-content: center;
`;

const GoogleButtonText = styled.Text`
  color: #1f1f1f;
  font-size: 15px;
  font-family: 'GolosText_600SemiBold';
`;

const Hint = styled.Text`
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  font-family: 'Inter_500Medium';
  text-align: center;
  margin-top: 14px;
  line-height: 16px;
`;

function showComingSoonEmail() {
  Alert.alert(
    'Próximamente',
    'Estamos preparando el registro con correo y contraseña. Por ahora, Spotify es la opción recomendada para calcular tu vibe y seguir con el onboarding.',
    [{ text: 'Entendido' }]
  );
}

function showComingSoonGoogle() {
  Alert.alert(
    'Próximamente',
    'El inicio de sesión con Google estará disponible pronto. Mientras tanto, conectá Spotify para la mejor experiencia en Encorely.',
    [{ text: 'Entendido' }]
  );
}

export default function OnboardingStep3Screen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onEmailContinue = () => {
    showComingSoonEmail();
  };

  return (
    <ScreenShell
      centerContent={false}
      gradientOpacity={0.75}
      edges={['top', 'left', 'right']}
      topContentGap={8}
    >
      <ScrollView
        style={{ width: '100%', flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: 40,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        <Wrap>
          <SpotifyConnectCard
            tag="NUEVO AQUÍ"
            title="Creá tu cuenta"
            body="Spotify es la opción recomendada: vinculamos tu música, calculamos tu vibe y personalizamos el descubrimiento. También podés usar correo o Google cuando estén listos."
            showRecommendedPill
          />

          <DividerRow>
            <DividerLine />
            <DividerText>O también</DividerText>
            <DividerLine />
          </DividerRow>

          <SectionLabel>Correo y contraseña</SectionLabel>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Correo electrónico"
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor="rgba(255,255,255,0.35)"
            secureTextEntry
          />
          <EmailButton onPress={onEmailContinue} activeOpacity={0.85}>
            <EmailButtonText>Continuar con correo</EmailButtonText>
          </EmailButton>

          <SectionLabel style={{ marginTop: 8 }}>Google</SectionLabel>
          <GoogleButton onPress={showComingSoonGoogle} activeOpacity={0.9}>
            <Ionicons name="logo-google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
            <GoogleButtonText>Continuar con Google</GoogleButtonText>
          </GoogleButton>

          <Hint>
            El acceso con correo y Google se activará en una próxima versión. Spotify ofrece hoy la
            experiencia completa de Encorely.
          </Hint>
        </Wrap>

        <Text
          style={{
            width: '100%',
            maxWidth: 400,
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            fontFamily: 'Inter_500Medium',
            marginTop: 12,
            textAlign: 'center',
            paddingHorizontal: 24,
          }}
        >
          Paso 3 de 6
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}
