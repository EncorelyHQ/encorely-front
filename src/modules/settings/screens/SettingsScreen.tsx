/**
 * SettingsScreen — Encorely
 * Secciones: Mi Perfil | Privacidad | Spotify | Cuenta
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/shared/context/AuthContext';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { useVibeVector } from '@/shared/hooks/useVibeVector';
import { useConcertMood } from '@/modules/settings/hooks/useConcertMood';
import { ConcertMood } from '@/clients/encorely/types';
import { concertMoodToLabel } from '@/modules/auth/utils/mapMood';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  fullName: string;
  age: string;
  gender: string;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_KEY = 'encorely_user_profile';
const RADAR_VISIBLE_KEY = 'encorely_radar_visible';
const SHOW_RECENTS_KEY = 'encorely_show_recents';

const GENDER_OPTIONS = ['Hombre', 'Mujer', 'Prefiero no decir'] as const;

// ─── Styled Components ────────────────────────────────────────────────────────

const BG = styled.View`
  flex: 1;
  background-color: #181818;
`;

const StyledSafe = styled(SafeAreaView)`
  flex: 1;
`;

// Header
const HeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 14px 22px 10px;
  gap: 12px;
`;

const BackBtn = styled.TouchableOpacity`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  background-color: rgba(255, 255, 255, 0.07);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  align-items: center;
  justify-content: center;
`;

const HeaderTitle = styled.Text`
  color: #ffffff;
  font-size: 20px;
  font-family: 'GolosText_700Bold';
`;

// Section
const SectionLabel = styled.Text`
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-family: 'Inter_500Medium';
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 10px;
  margin-left: 2px;
`;

const GlassCard = styled(BlurView)`
  border-radius: 20px;
  overflow: hidden;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.07);
  background-color: rgba(255, 255, 255, 0.03);
  margin-bottom: 6px;
`;

const CardPad = styled.View`
  padding: 18px 20px;
`;

// Form fields
const FieldLabel = styled.Text`
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-bottom: 7px;
`;

const StyledInput = styled.TextInput`
  background-color: rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 13px 15px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'Inter_500Medium';
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  margin-bottom: 4px;
`;

const TextArea = styled.TextInput`
  background-color: rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 13px 15px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'Inter_500Medium';
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  min-height: 80px;
  text-align-vertical: top;
  margin-bottom: 4px;
`;

const ErrorMsg = styled.Text`
  color: #ff6b6b;
  font-size: 11px;
  font-family: 'Inter_500Medium';
  margin-bottom: 10px;
  margin-left: 2px;
`;

const CharCounter = styled.Text`
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-family: 'Inter_500Medium';
  text-align: right;
  margin-bottom: 14px;
`;

const FieldGroup = styled.View`
  margin-bottom: 14px;
`;

// Gender chips
const GenderRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const GenderChip = styled.TouchableOpacity<{ selected: boolean }>`
  padding-horizontal: 14px;
  padding-vertical: 9px;
  border-radius: 99px;
  border-width: 1px;
  border-color: ${(p: any) => (p.selected ? '#F366FF' : 'rgba(255,255,255,0.15)')};
  background-color: ${(p: any) => (p.selected ? 'rgba(243,102,255,0.18)' : 'rgba(255,255,255,0.05)')};
`;

const GenderChipText = styled.Text<{ selected: boolean }>`
  color: ${(p: any) => (p.selected ? '#F366FF' : 'rgba(255,255,255,0.55)')};
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

// Buttons
const SaveBtn = styled.TouchableOpacity`
  background-color: #f366ff;
  border-radius: 12px;
  padding-vertical: 15px;
  align-items: center;
  margin-top: 6px;
  elevation: 8;
  shadow-color: #f366ff;
  shadow-offset: 0px 4px;
  shadow-opacity: 0.35;
  shadow-radius: 10px;
`;

const SaveBtnText = styled.Text`
  color: #ffffff;
  font-size: 15px;
  font-family: 'GolosText_700Bold';
`;

// Toggle rows
const ToggleRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-vertical: 12px;
`;

const ToggleLeft = styled.View`
  flex: 1;
  padding-right: 16px;
`;

const ToggleTitle = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-family: 'Inter_500Medium';
  margin-bottom: 2px;
`;

const ToggleSub = styled.Text`
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  font-family: 'Inter_500Medium';
`;

const RowSep = styled.View`
  height: 1px;
  background-color: rgba(255, 255, 255, 0.06);
`;

// Spotify row
const SpotifyCardRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 14px;
`;

const SpotifyLogoCircle = styled.View`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: #1db954;
  align-items: center;
  justify-content: center;
`;

const SpotifyInfo = styled.View`
  flex: 1;
`;

const SpotifyConnectedText = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-family: 'GolosText_700Bold';
`;

const SpotifySubText = styled.Text`
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-top: 2px;
`;

const UpdateVibeBtn = styled.TouchableOpacity`
  background-color: rgba(255, 255, 255, 0.09);
  border-radius: 99px;
  padding-horizontal: 14px;
  padding-vertical: 8px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.15);
`;

const UpdateVibeBtnText = styled.Text`
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-family: 'Inter_500Medium';
`;

// Account rows
const AccountRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-vertical: 14px;
`;

const AccountRowText = styled.Text`
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  font-family: 'Inter_500Medium';
`;

const VersionText = styled.Text`
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
  font-family: 'Inter_500Medium';
  padding-vertical: 14px;
`;

const LogoutBtn = styled.TouchableOpacity`
  border-radius: 12px;
  padding-vertical: 15px;
  align-items: center;
  margin: 4px 22px 0;
  border-width: 1px;
  border-color: rgba(255, 107, 107, 0.35);
  background-color: rgba(255, 107, 107, 0.1);
`;

const LogoutText = styled.Text`
  color: #ff6b6b;
  font-size: 15px;
  font-family: 'GolosText_700Bold';
`;

// ─── Settings Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { user: authUser, logout, setSession, vibeVector } = useAuth();
  const { logout: encorelyLogout } = useEncorelyAuth();
  const { user: spotifyUser, logout: spotifyLogout, getValidToken } = useSpotifyAuth();
  const { compute: computeVibe, isLoading: isComputing } = useVibeVector();
  const { mood, updateMood, saving: moodSaving, error: moodError } = useConcertMood();

  const MOOD_OPTIONS: { value: ConcertMood; label: string }[] = [
    { value: ConcertMood.Moshpit, label: concertMoodToLabel(ConcertMood.Moshpit) },
    { value: ConcertMood.Chill, label: concertMoodToLabel(ConcertMood.Chill) },
    { value: ConcertMood.VIP, label: concertMoodToLabel(ConcertMood.VIP) },
  ];

  // Profile form
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    age: '',
    gender: '',
    description: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof UserProfile, string>>>({});
  const [saved, setSaved] = useState(false);

  // Privacy toggles
  const [radarVisible, setRadarVisible] = useState(true);
  const [showRecents, setShowRecents] = useState(true);

  // Load from AsyncStorage
  useEffect(() => {
    (async () => {
      const [profileRaw, radarRaw, showRaw] = await Promise.all([
        AsyncStorage.getItem(PROFILE_KEY),
        AsyncStorage.getItem(RADAR_VISIBLE_KEY),
        AsyncStorage.getItem(SHOW_RECENTS_KEY),
      ]);
      if (profileRaw) setProfile(JSON.parse(profileRaw));
      if (radarRaw !== null) setRadarVisible(radarRaw === 'true');
      if (showRaw !== null) setShowRecents(showRaw === 'true');
    })();
  }, []);

  const handleToggleRadar = async (val: boolean) => {
    setRadarVisible(val);
    await AsyncStorage.setItem(RADAR_VISIBLE_KEY, String(val));
  };

  const handleToggleRecents = async (val: boolean) => {
    setShowRecents(val);
    await AsyncStorage.setItem(SHOW_RECENTS_KEY, String(val));
  };

  // Validate & save profile
  const validate = (): boolean => {
    const e: Partial<Record<keyof UserProfile, string>> = {};
    if (!profile.fullName.trim()) e.fullName = 'El nombre es obligatorio';
    if (!profile.age.trim()) {
      e.age = 'La edad es obligatoria';
    } else {
      const n = parseInt(profile.age, 10);
      if (isNaN(n) || n < 13 || n > 99) e.age = 'Ingresa una edad válida (13–99)';
    }
    if (!profile.gender) e.gender = 'Selecciona tu género';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Sync vibe
  const handleSyncVibe = async () => {
    const token = await getValidToken();
    if (!token) return;
    const result = await computeVibe(token);
    if (result) {
      const user = spotifyUser ?? authUser;
      if (user && token) await setSession(user, token, result);
      Alert.alert('¡Listo!', 'Tu Vibe Vector ha sido actualizado.');
    }
  };

  // Logout
  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await spotifyLogout();
            await encorelyLogout();
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const displayUser = spotifyUser ?? authUser;

  return (
    <BG>
      <LinearGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', inset: 0, opacity: 0.55 }}
      />
      <StyledSafe>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <HeaderRow>
            <BackBtn onPress={() => router.back()} activeOpacity={0.75}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" />
            </BackBtn>
            <HeaderTitle>Ajustes</HeaderTitle>
          </HeaderRow>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 22, paddingTop: 8, gap: 6, paddingBottom: 60 }}
          >

            {/* ── SECCIÓN 1: MI PERFIL ────────────────────────────────────── */}
            <SectionLabel>Mi perfil</SectionLabel>
            <GlassCard intensity={20} tint="dark">
              <CardPad>

                {/* Nombre */}
                <FieldGroup>
                  <FieldLabel>Nombre completo *</FieldLabel>
                  <StyledInput
                    placeholder="Tu nombre"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    value={profile.fullName}
                    onChangeText={(t: string) => setProfile((p) => ({ ...p, fullName: t }))}
                    autoCapitalize="words"
                  />
                  {errors.fullName ? <ErrorMsg>{errors.fullName}</ErrorMsg> : null}
                </FieldGroup>

                {/* Edad */}
                <FieldGroup>
                  <FieldLabel>Edad *</FieldLabel>
                  <StyledInput
                    placeholder="ej. 24"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    value={profile.age}
                    onChangeText={(t: string) => setProfile((p) => ({ ...p, age: t.replace(/[^0-9]/g, '') }))}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  {errors.age ? <ErrorMsg>{errors.age}</ErrorMsg> : null}
                </FieldGroup>

                {/* Género */}
                <FieldGroup>
                  <FieldLabel>Género *</FieldLabel>
                  <GenderRow>
                    {GENDER_OPTIONS.map((opt) => (
                      <GenderChip
                        key={opt}
                        selected={profile.gender === opt}
                        onPress={() => setProfile((p) => ({ ...p, gender: opt }))}
                        activeOpacity={0.7}
                      >
                        <GenderChipText selected={profile.gender === opt}>{opt}</GenderChipText>
                      </GenderChip>
                    ))}
                  </GenderRow>
                  {errors.gender ? <ErrorMsg style={{ marginTop: 8 }}>{errors.gender}</ErrorMsg> : null}
                </FieldGroup>

                {/* Descripción */}
                <FieldGroup>
                  <FieldLabel>Descripción (opcional)</FieldLabel>
                  <TextArea
                    placeholder="Cuéntale a la comunidad quién eres... 🎵"
                    placeholderTextColor="rgba(255,255,255,0.22)"
                    value={profile.description}
                    onChangeText={(t: string) => setProfile((p) => ({ ...p, description: t.slice(0, 150) }))}
                    multiline
                    numberOfLines={3}
                    maxLength={150}
                  />
                  <CharCounter>{profile.description.length}/150</CharCounter>
                </FieldGroup>

                <SaveBtn onPress={handleSave} activeOpacity={0.8}>
                  <SaveBtnText>{saved ? '¡Guardado! ✓' : 'Guardar cambios'}</SaveBtnText>
                </SaveBtn>
              </CardPad>
            </GlassCard>

            {/* ── SECCIÓN 2: MOOD DE CONCIERTO ─────────────────────────────── */}
            <View style={{ height: 10 }} />
            <SectionLabel>Mood de concierto</SectionLabel>
            <GlassCard intensity={20} tint="dark">
              <CardPad>
                <ToggleSub style={{ marginBottom: 12 }}>
                  Cómo te gusta vivir los shows (se guarda en el servidor)
                </ToggleSub>
                <GenderRow>
                  {MOOD_OPTIONS.map((opt) => (
                    <GenderChip
                      key={opt.value}
                      selected={mood === opt.value}
                      onPress={() => void updateMood(opt.value)}
                      activeOpacity={0.7}
                      disabled={moodSaving}
                    >
                      <GenderChipText selected={mood === opt.value}>{opt.label}</GenderChipText>
                    </GenderChip>
                  ))}
                </GenderRow>
                {moodError ? <ErrorMsg style={{ marginTop: 8 }}>{moodError}</ErrorMsg> : null}
              </CardPad>
            </GlassCard>

            {/* ── SECCIÓN 3: PRIVACIDAD ───────────────────────────────────── */}
            <View style={{ height: 10 }} />
            <SectionLabel>Privacidad</SectionLabel>
            <GlassCard intensity={20} tint="dark">
              <CardPad>
                <ToggleRow>
                  <ToggleLeft>
                    <ToggleTitle>Visible en Radar Social</ToggleTitle>
                    <ToggleSub>Aparece en el radar de otros usuarios</ToggleSub>
                  </ToggleLeft>
                  <Switch
                    value={radarVisible}
                    onValueChange={handleToggleRadar}
                    trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#F366FF' }}
                    thumbColor="#FFFFFF"
                  />
                </ToggleRow>
                <RowSep />
                <ToggleRow>
                  <ToggleLeft>
                    <ToggleTitle>Mostrar reproducciones recientes</ToggleTitle>
                    <ToggleSub>Otros pueden ver lo que estás escuchando</ToggleSub>
                  </ToggleLeft>
                  <Switch
                    value={showRecents}
                    onValueChange={handleToggleRecents}
                    trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#F366FF' }}
                    thumbColor="#FFFFFF"
                  />
                </ToggleRow>
              </CardPad>
            </GlassCard>

            {/* ── SECCIÓN 4: SPOTIFY ──────────────────────────────────────── */}
            <View style={{ height: 10 }} />
            <SectionLabel>Cuenta Spotify</SectionLabel>
            <GlassCard intensity={20} tint="dark">
              <CardPad>
                <SpotifyCardRow>
                  <SpotifyLogoCircle>
                    <Ionicons name="musical-notes" size={20} color="#000" />
                  </SpotifyLogoCircle>
                  <SpotifyInfo>
                    <SpotifyConnectedText>Conectado como</SpotifyConnectedText>
                    <SpotifySubText numberOfLines={1}>{displayUser?.name ?? '—'}</SpotifySubText>
                  </SpotifyInfo>
                  <UpdateVibeBtn onPress={handleSyncVibe} disabled={isComputing} activeOpacity={0.75}>
                    {isComputing ? (
                      <ActivityIndicator size="small" color="#F366FF" />
                    ) : (
                      <UpdateVibeBtnText>Actualizar vibe →</UpdateVibeBtnText>
                    )}
                  </UpdateVibeBtn>
                </SpotifyCardRow>
              </CardPad>
            </GlassCard>

            {/* ── SECCIÓN 5: CUENTA ───────────────────────────────────────── */}
            <View style={{ height: 10 }} />
            <SectionLabel>Cuenta</SectionLabel>
            <GlassCard intensity={20} tint="dark">
              <CardPad>
                <AccountRow
                  onPress={() =>
                    Alert.alert('Próximamente', 'Los términos y condiciones estarán disponibles pronto.')
                  }
                  activeOpacity={0.7}
                >
                  <AccountRowText>Términos y condiciones</AccountRowText>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </AccountRow>
                <RowSep />
                <AccountRow
                  onPress={() =>
                    Alert.alert('Próximamente', 'La política de privacidad estará disponible pronto.')
                  }
                  activeOpacity={0.7}
                >
                  <AccountRowText>Política de privacidad</AccountRowText>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </AccountRow>
                <RowSep />
                <View style={{ paddingVertical: 14 }}>
                  <VersionText>Versión 1.0.0-MVP</VersionText>
                </View>
              </CardPad>
            </GlassCard>

            {/* ── LOGOUT ─────────────────────────────────────────────────── */}
            <View style={{ height: 10 }} />
            <LogoutBtn onPress={handleLogout} activeOpacity={0.8} style={{ marginHorizontal: 0 }}>
              <LogoutText>Cerrar sesión</LogoutText>
            </LogoutBtn>

          </ScrollView>
        </KeyboardAvoidingView>
      </StyledSafe>
    </BG>
  );
}
