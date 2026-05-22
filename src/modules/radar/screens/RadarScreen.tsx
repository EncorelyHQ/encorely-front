import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RADAR_SWIPES_THRESHOLD } from '@/config/onboarding';

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }: any) => theme.colors.background};
`;

const BackgroundGradient = styled(LinearGradient)`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  opacity: 0.6;
`;

const StyledSafeArea = styled(SafeAreaView)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const GlassCard = styled(BlurView)`
  border-radius: 32px;
  padding: 32px;
  align-items: center;
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.primary};
  background-color: ${({ theme }: any) => theme.colors.glassNeon};
  width: 100%;
`;

const Title = styled.Text`
  font-size: 32px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBlack};
  color: ${({ theme }: any) => theme.colors.text};
  margin-bottom: 20px;
  text-align: center;
  text-shadow-color: ${({ theme }: any) => theme.colors.primary};
  text-shadow-radius: 20px;
`;

const Subtitle = styled.Text`
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.body};
  color: ${({ theme }: any) => theme.colors.textDim};
  text-align: center;
  margin-bottom: 40px;
  line-height: 24px;
`;

const PrimaryButton = styled.TouchableOpacity`
  background-color: ${({ theme }: any) => theme.colors.primary};
  border-radius: ${({ theme }: any) => theme.components.button.radiusCircle}px;
  padding-horizontal: 30px;
  padding-vertical: 16px;
  elevation: 10;
  shadow-color: ${({ theme }: any) => theme.colors.primary};
  shadow-offset: 0px 4px;
  shadow-opacity: 0.6;
  shadow-radius: 16px;
  width: 100%;
  align-items: center;
`;

const PrimaryButtonText = styled.Text`
  color: #FFFFFF;
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
`;

const NextStepsContainer = styled.View`
  width: 100%;
  margin-top: 30px;
  gap: 12px;
`;

const NextStepCard = styled(BlurView)<{ disabled?: boolean }>`
  border-radius: 16px;
  padding: 16px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  border-width: 1px;
  border-color: rgba(255,255,255,0.05);
  background-color: rgba(255,255,255,0.03);
  opacity: ${(props: { disabled?: boolean }) => props.disabled ? 0.5 : 1};
`;

const StepTextContainer = styled.View`
  flex: 1;
  margin-left: 12px;
`;

const StepTitle = styled.Text`
  color: #FFF;
  font-size: 14px;
  font-family: 'GolosText_700Bold';
`;

const StepSubtitle = styled.Text`
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  font-family: 'Inter_500Medium';
`;

const StatsPill = styled.View`
  background-color: rgba(243, 102, 255, 0.1);
  padding-horizontal: 12px;
  padding-vertical: 6px;
  border-radius: 99px;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.3);
  margin-bottom: 24px;
`;

const StatsText = styled.Text`
  color: #F366FF;
  font-size: 13px;
  font-family: 'GolosText_700Bold';
`;

export default function RadarScreen() {
  const router = useRouter();

  return (
    <Container>
      <BackgroundGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StyledSafeArea>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
          <GlassCard intensity={40} tint="dark">
            <Text style={{ fontSize: 60, marginBottom: 16 }}>🌍</Text>
            <Title>Radar Social</Title>
            <Subtitle>
              {`¡Felicidades! Alcanzaste el umbral de los ${RADAR_SWIPES_THRESHOLD} swipes. `}
              Tu Vibe ha sido calculado y el Radar Social está listo para futuras conexiones.
            </Subtitle>

            <StatsPill>
              <StatsText>📡 247 personas con tu vibe cerca</StatsText>
            </StatsPill>
            
            <PrimaryButton onPress={() => router.push('/(main)/radar-matches')}>
              <PrimaryButtonText>Ver Personas Compatibles</PrimaryButtonText>
            </PrimaryButton>
          </GlassCard>

          <NextStepsContainer>
             <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'GolosText_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 }}>
               Próximos Pasos
             </Text>
             
             <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(main)/radar-matches')}>
               <NextStepCard intensity={20}>
                 <Ionicons name="people-outline" size={24} color="#F366FF" />
                 <StepTextContainer>
                   <StepTitle>Explorar Matches</StepTitle>
                   <StepSubtitle>Conecta con personas compatibles</StepSubtitle>
                 </StepTextContainer>
                 <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
               </NextStepCard>
             </TouchableOpacity>

             <NextStepCard intensity={20} disabled>
               <Ionicons name="location-outline" size={24} color="#F366FF" />
               <StepTextContainer>
                 <StepTitle>Sincronizar Ubicación</StepTitle>
                 <StepSubtitle>Próximamente para eventos en vivo</StepSubtitle>
               </StepTextContainer>
               <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.2)" />
             </NextStepCard>

             <NextStepCard intensity={20} disabled>
               <Ionicons name="musical-notes-outline" size={24} color="#F366FF" />
               <StepTextContainer>
                 <StepTitle>Explorar Conciertos</StepTitle>
                 <StepSubtitle>Busca fans en tus próximos shows</StepSubtitle>
               </StepTextContainer>
               <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.2)" />
             </NextStepCard>

             <TouchableOpacity style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.replace('/(main)')}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Inter_500Medium' }}>Volver al Inicio</Text>
             </TouchableOpacity>
          </NextStepsContainer>
        </ScrollView>
      </StyledSafeArea>
    </Container>
  );
}
