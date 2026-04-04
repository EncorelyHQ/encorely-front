import React, { useRef, useState, useEffect } from 'react';
import { View, Text, FlatList, Dimensions, Animated, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { useVibeVector } from '@/shared/hooks/useVibeVector';
import { useAuth } from '@/shared/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

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
  opacity: 0.8;
`;

const StyledSafeArea = styled(SafeAreaView)`
  flex: 1;
`;

const SlideContainer = styled.View`
  width: ${width}px;
  flex: 1;
  padding-horizontal: 28px;
  padding-top: 44px;
  padding-bottom: 30px;
  justify-content: flex-end;
`;

const LogoBlock = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  position: absolute;
  top: 60px;
  align-self: center;
`;

const LogoEmoji = styled.Text`
  font-size: 30px;
`;

const LogoText = styled.Text`
  font-size: 24px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.text};
`;

const HeroTitle = styled.Text`
  font-size: 42px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBlack};
  color: ${({ theme }: any) => theme.colors.text};
  letter-spacing: -1.5px;
  text-align: center;
  margin-bottom: 16px;
`;

const HeroSub = styled.Text`
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.body};
  color: ${({ theme }: any) => theme.colors.textDim};
  text-align: center;
  line-height: 24px;
  margin-bottom: 40px;
  padding-horizontal: 20px;
`;

const PrimaryButton = styled.TouchableOpacity`
  background-color: ${({ theme }: any) => theme.colors.primary};
  border-radius: ${({ theme }: any) => theme.components.button.radiusCircle}px;
  padding-vertical: 16px;
  align-items: center;
  margin-bottom: 20px;
  shadow-color: ${({ theme }: any) => theme.colors.primary};
  shadow-offset: 0px 4px;
  shadow-opacity: 0.6;
  shadow-radius: 16px;
  elevation: 10;
`;

const PrimaryButtonText = styled.Text`
  color: #ffffff;
  font-size: 16px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
`;

const SecondaryButton = styled.TouchableOpacity`
  background-color: transparent;
  border-radius: ${({ theme }: any) => theme.components.button.radiusCircle}px;
  padding-vertical: 16px;
  align-items: center;
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.glassLight};
`;

const SecondaryButtonText = styled.Text`
  color: ${({ theme }: any) => theme.colors.text};
  font-size: 14px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyMedium};
`;

const GlassCard = styled(BlurView)`
  border-radius: 24px;
  padding: 24px;
  overflow: hidden;
  border-width: 1px;
  border-color: ${({ theme }: any) => theme.colors.glassLight};
  background-color: ${({ theme }: any) => theme.colors.glassDark};
  margin-bottom: 40px;
`;

const SectionTag = styled.Text`
  font-size: 11px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBold};
  color: ${({ theme }: any) => theme.colors.primary};
  letter-spacing: 2px;
  margin-bottom: 12px;
  text-align: center;
`;

const SlideTitle = styled.Text`
  font-size: 32px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.headingBlack};
  color: ${({ theme }: any) => theme.colors.text};
  text-align: center;
  margin-bottom: 16px;
`;

const DimList = styled.View`
  gap: 14px;
  margin-vertical: 20px;
`;

const DimRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const DimLabel = styled.Text`
  width: 64px;
  font-size: 12px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyBold};
  color: ${({ theme }: any) => theme.colors.text};
`;

const BarTrack = styled.View`
  flex: 1;
  height: 6px;
  background-color: ${({ theme }: any) => theme.colors.glassLight};
  border-radius: 99px;
  overflow: hidden;
`;

const BarFillWrapper = styled(Animated.View)`
  height: 100%;
  border-radius: 99px;
`;

const DimVal = styled.Text<{ color: string }>`
  width: 34px;
  font-size: 12px;
  font-family: ${({ theme }: any) => theme.typography.fontFamily.bodyBold};
  text-align: right;
  color: ${({ color }: { color: string }) => color};
`;

const SpotifyButton = styled(PrimaryButton)`
  background-color: ${({ theme }: any) => theme.colors.primary};
  shadow-color: ${({ theme }: any) => theme.colors.primary};
  flex-direction: row;
  justify-content: center;
  gap: 10px;
`;

function AnimatedBar({ value, color }: { value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, []);
  return (
    <BarTrack>
      <BarFillWrapper
        style={{
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </BarTrack>
  );
}

function SlideWelcome({ onNext }: { onNext: () => void }) {
  return (
    <SlideContainer>
      <LogoBlock>
        <LogoEmoji>🎵</LogoEmoji>
        <LogoText>Encorely</LogoText>
      </LogoBlock>

      <HeroTitle>No vuelvas a ir solo a un concierto</HeroTitle>
      <HeroSub>
        Te conectamos con personas compatibles según lo que escuchas en Spotify
      </HeroSub>

      <PrimaryButton onPress={onNext}>
        <PrimaryButtonText>Comenzar</PrimaryButtonText>
      </PrimaryButton>

      <SecondaryButton onPress={onNext}>
        <SecondaryButtonText>Ya tengo cuenta, iniciar sesión</SecondaryButtonText>
      </SecondaryButton>
    </SlideContainer>
  );
}

const DIMS = [
  { label: 'Energy', value: 0.78, color: '#F366FF' },
  { label: 'Baile', value: 0.65, color: '#F97316' },
  { label: 'Valencia', value: 0.52, color: '#EAB308' },
  { label: 'Tempo', value: 0.84, color: '#A855F7' },
];

function SlideVibeVector({ onNext }: { onNext: () => void }) {
  return (
    <SlideContainer style={{ justifyContent: 'center' }}>
      <GlassCard intensity={40} tint="dark">
        <SectionTag>TU MUSIC DNA</SectionTag>
        <SlideTitle>Vector de Vibe</SlideTitle>
        <HeroSub style={{ marginBottom: 0 }}>
          Descubrimos tu perfil analizando tus 50 tracks más recientes en Spotify.
        </HeroSub>

        <DimList>
          {DIMS.map((d) => (
            <DimRow key={d.label}>
              <DimLabel>{d.label}</DimLabel>
              <AnimatedBar value={d.value} color={d.color} />
              <DimVal color={d.color}>{Math.round(d.value * 100)}%</DimVal>
            </DimRow>
          ))}
        </DimList>
      </GlassCard>

      <PrimaryButton onPress={onNext}>
        <PrimaryButtonText>Siguiente</PrimaryButtonText>
      </PrimaryButton>
    </SlideContainer>
  );
}

function SlideConnect() {
  const router = useRouter();
  const { user, isLoggingIn, error, login, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, usedFallback } = useVibeVector();
  const { setSession } = useAuth();
  const [computing, setComputing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (!user) return;
    (async () => {
      setComputing(true);
      const token = await getValidToken();
      if (!token) {
        setComputing(false);
        return;
      }
      const vibe = await computeVibe(token);
      await setSession(user, token, vibe);
      if (usedFallback) {
        Alert.alert(
          '🎵 Vibe Básico Activado',
          'Usando análisis de metadatos. Para mayor precisión, actualiza los permisos de tu app Spotify.',
          [{ text: 'Entendido' }]
        );
      }
      setComputing(false);
      router.replace('/(main)');
    })();
  }, [user]);

  return (
    <SlideContainer style={{ justifyContent: 'center' }}>
      <GlassCard intensity={40} tint="dark">
        <SectionTag>CONEXIÓN SEGURA</SectionTag>
        <SlideTitle>Conecta Spotify</SlideTitle>
        <HeroSub>
          Solo leemos tu historial de reproducción reciente para calcular tu compatibilidad.
        </HeroSub>

        <View style={{ gap: 12, marginBottom: 30 }}>
          <Text style={{ color: theme.colors.textDim, fontFamily: theme.typography.fontFamily.body }}>
            ✅ Historial de reproducción (50 tracks)
          </Text>
          <Text style={{ color: theme.colors.textDim, fontFamily: theme.typography.fontFamily.body }}>
            ✅ Tu perfil público
          </Text>
          <Text style={{ color: theme.colors.textDim, fontFamily: theme.typography.fontFamily.body }}>
            ❌ No leemos playlists privadas
          </Text>
        </View>

        {error ? (
          <View style={{ backgroundColor: '#7F1D1D22', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ color: '#FCA5A5', textAlign: 'center', fontFamily: theme.typography.fontFamily.body }}>
              ⚠️ {error}
            </Text>
          </View>
        ) : null}

        <SpotifyButton onPress={login} disabled={isLoggingIn || computing} style={{ opacity: isLoggingIn || computing ? 0.7 : 1, marginBottom: 0 }}>
          {isLoggingIn || computing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ color: '#fff', fontSize: 20 }}>♪</Text>
              <PrimaryButtonText>Conectar con Spotify</PrimaryButtonText>
            </>
          )}
        </SpotifyButton>
        {computing && (
          <Text
            style={{
              color: theme.colors.textDim,
              textAlign: 'center',
              marginTop: 16,
              fontFamily: theme.typography.fontFamily.body,
            }}
          >
            ⚡ Analizando tu perfil musical...
          </Text>
        )}
      </GlassCard>
    </SlideContainer>
  );
}

const SLIDES = ['welcome', 'vibe', 'connect'] as const;

export default function OnboardingScreen() {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const theme = useTheme();

  const goNext = () => {
    const next = Math.min(currentIndex + 1, SLIDES.length - 1);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  const renderSlide = ({ item }: { item: (typeof SLIDES)[number] }) => (
    <View style={{ width }}>
      {item === 'welcome' && <SlideWelcome onNext={goNext} />}
      {item === 'vibe' && <SlideVibeVector onNext={goNext} />}
      {item === 'connect' && <SlideConnect />}
    </View>
  );

  const dots = SLIDES.map((_, i) => {
    const scaleX = scrollX.interpolate({
      inputRange: [(i - 1) * width, i * width, (i + 1) * width],
      outputRange: [1, 2.4, 1],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange: [(i - 1) * width, i * width, (i + 1) * width],
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View
        key={i}
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.text,
          opacity,
          transform: [{ scaleX }],
        }}
      />
    );
  });

  return (
    <Container>
      <BackgroundGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View
        style={{
          position: 'absolute',
          bottom: -100,
          left: -50,
          right: -50,
          height: 400,
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          borderRadius: 999,
          transform: [{ scaleX: 1.5 }],
        }}
      />

      <StyledSafeArea edges={['top', 'bottom']}>
        <Animated.FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onMomentumScrollEnd={(e) => {
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 20 }}>
          {dots}
        </View>
      </StyledSafeArea>
    </Container>
  );
}
