import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Linking,
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
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  fullName: string;
  age: string;
  gender: string;
  description: string;
}

interface CurrentlyPlaying {
  trackName: string;
  artistName: string;
  albumArt: string | null;
}

interface RecentTrack {
  id: string;
  trackName: string;
  artistName: string;
  albumArt: string | null;
  playedAt: string;
  spotifyUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

const PROFILE_KEY = 'encorely_user_profile';
const GENDER_OPTIONS = ['Hombre', 'Mujer', 'No binario', 'Prefiero no decir'];

// ─── Styled Components ────────────────────────────────────────────────────────

const Container = styled.View`
  flex: 1;
  background-color: #181818;
`;

const StyledSafeArea = styled(SafeAreaView)`
  flex: 1;
`;

// Header
const HeaderRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 8px;
`;

const HeaderLeft = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 14px;
`;

const AvatarWrap = styled.View`
  position: relative;
`;

const AvatarImg = styled.Image`
  width: 80px;
  height: 80px;
  border-radius: 40px;
  border-width: 2px;
  border-color: #F366FF;
`;

const AvatarPlaceholder = styled.View`
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background-color: rgba(243, 102, 255, 0.2);
  border-width: 2px;
  border-color: #F366FF;
  align-items: center;
  justify-content: center;
`;

const UserInfoCol = styled.View``;

const UserNameText = styled.Text`
  color: #FFFFFF;
  font-size: 20px;
  font-family: 'GolosText_700Bold';
  margin-bottom: 6px;
`;

const VibeBadge = styled.View`
  background-color: rgba(243, 102, 255, 0.2);
  border-radius: 99px;
  padding-horizontal: 12px;
  padding-vertical: 4px;
  align-self: flex-start;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.4);
`;

const VibeBadgeText = styled.Text`
  color: #F366FF;
  font-size: 11px;
  font-family: 'Inter_500Medium';
`;

const SettingsBtn = styled.TouchableOpacity`
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.06);
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  align-self: flex-start;
  margin-top: 4px;
`;

// Glass Card
const GlassCard = styled(BlurView)`
  border-radius: 24px;
  overflow: hidden;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.08);
  background-color: rgba(255, 255, 255, 0.03);
  margin: 0 22px;
`;

const CardInner = styled.View`
  padding: 20px;
`;

// Profile form
const SectionLabel = styled.Text`
  color: rgba(255, 255, 255, 0.4);
  font-size: 10px;
  font-family: 'GolosText_700Bold';
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 14px;
`;

const FieldLabel = styled.Text`
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-bottom: 6px;
`;

const StyledInput = styled.TextInput`
  background-color: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  color: #FFFFFF;
  font-size: 14px;
  font-family: 'Inter_500Medium';
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  margin-bottom: 14px;
`;

const TextAreaInput = styled.TextInput`
  background-color: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  color: #FFFFFF;
  font-size: 14px;
  font-family: 'Inter_500Medium';
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  margin-bottom: 4px;
  min-height: 80px;
  text-align-vertical: top;
`;

const CharCount = styled.Text`
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-family: 'Inter_500Medium';
  text-align: right;
  margin-bottom: 14px;
`;

const ErrorText = styled.Text`
  color: #FF4B4B;
  font-size: 11px;
  font-family: 'Inter_500Medium';
  margin-top: -10px;
  margin-bottom: 10px;
  margin-left: 4px;
`;

const GenderRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
`;

const GenderChip = styled.TouchableOpacity<{ selected: boolean }>`
  padding-horizontal: 14px;
  padding-vertical: 8px;
  border-radius: 99px;
  border-width: 1px;
  border-color: ${(p: any) => p.selected ? '#F366FF' : 'rgba(255,255,255,0.15)'};
  background-color: ${(p: any) => p.selected ? 'rgba(243,102,255,0.15)' : 'transparent'};
`;

const GenderChipText = styled.Text<{ selected: boolean }>`
  color: ${(p: any) => p.selected ? '#F366FF' : 'rgba(255,255,255,0.6)'};
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

const SaveButton = styled.TouchableOpacity`
  background-color: #F366FF;
  border-radius: 99px;
  padding-vertical: 14px;
  align-items: center;
  margin-top: 4px;
  elevation: 8;
  shadow-color: #F366FF;
  shadow-offset: 0px 4px;
  shadow-opacity: 0.4;
  shadow-radius: 12px;
`;

const SaveButtonText = styled.Text`
  color: #FFFFFF;
  font-size: 15px;
  font-family: 'GolosText_700Bold';
`;

const EditButton = styled.TouchableOpacity`
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.5);
  border-radius: 99px;
  padding-vertical: 10px;
  align-items: center;
  margin-top: 6px;
`;

const EditButtonText = styled.Text`
  color: #F366FF;
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

const ReadField = styled.View`
  margin-bottom: 12px;
`;

const ReadLabel = styled.Text`
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  font-family: 'Inter_500Medium';
  margin-bottom: 2px;
`;

const ReadValue = styled.Text`
  color: #FFFFFF;
  font-size: 15px;
  font-family: 'Inter_500Medium';
`;

const CTAText = styled.Text`
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  text-align: center;
  margin-bottom: 16px;
  line-height: 20px;
`;

// Currently Playing
const NowPlayingPill = styled(BlurView)`
  border-radius: 50px;
  overflow: hidden;
  margin: 0 22px;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.04);
`;

const NowPlayingInner = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 14px 18px;
  gap: 12px;
`;

const NowPlayingInfo = styled.View`
  flex: 1;
`;

const NowPlayingTrack = styled.Text`
  color: #FFFFFF;
  font-size: 14px;
  font-family: 'GolosText_700Bold';
`;

const NowPlayingArtist = styled.Text`
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-top: 2px;
`;

const SpotifyBadge = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
`;

const SpotifyBadgeText = styled.Text`
  color: #1DB954;
  font-size: 11px;
  font-family: 'Inter_500Medium';
`;

// Recent tracks
const RecentHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 22px;
`;

const RecentTitle = styled.Text`
  color: #FFFFFF;
  font-size: 16px;
  font-family: 'GolosText_700Bold';
`;

const VerMasBtn = styled.TouchableOpacity``;

const VerMasText = styled.Text`
  color: #F366FF;
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

const RecentCard = styled(BlurView)`
  border-radius: 20px;
  overflow: hidden;
  margin: 0 22px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.06);
  background-color: rgba(255, 255, 255, 0.03);
`;

const TrackRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 14px 16px;
  gap: 14px;
`;

const TrackSeparator = styled.View`
  height: 1px;
  background-color: rgba(255, 255, 255, 0.06);
  margin-left: 78px;
`;

const AlbumArt = styled.Image`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background-color: rgba(255,255,255,0.05);
`;

const AlbumArtPlaceholder = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background-color: rgba(243, 102, 255, 0.1);
  align-items: center;
  justify-content: center;
`;

const TrackInfo = styled.View`
  flex: 1;
`;

const TrackName = styled.Text`
  color: #FFFFFF;
  font-size: 14px;
  font-family: 'GolosText_700Bold';
`;

const TrackArtist = styled.Text`
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-top: 2px;
`;

const TimePill = styled.View`
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  padding-horizontal: 10px;
  padding-vertical: 5px;
`;

const TimePillText = styled.Text`
  color: #F366FF;
  font-size: 11px;
  font-family: 'Inter_500Medium';
`;

// Pulsing headphone icon
function PulsingIcon() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="headset" size={24} color="#F366FF" />
    </Animated.View>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { user: spotifyUser, getValidToken } = useSpotifyAuth();

  const displayUser = spotifyUser ?? authUser;

  // Profile form state
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    age: '',
    gender: '',
    description: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<UserProfile>>({});

  // Spotify data
  const [nowPlaying, setNowPlaying] = useState<CurrentlyPlaying | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Load saved profile
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (raw) {
        const parsed: UserProfile = JSON.parse(raw);
        setProfile(parsed);
        const filled = parsed.fullName && parsed.age && parsed.gender;
        setProfileSaved(!!filled);
        setIsEditing(!filled);
      } else {
        setIsEditing(true);
      }
    });
  }, []);

  // Fetch Spotify data
  const fetchSpotifyData = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;

    // Currently playing
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data?.item && data.is_playing) {
          setNowPlaying({
            trackName: data.item.name,
            artistName: data.item.artists.map((a: any) => a.name).join(', '),
            albumArt: data.item.album?.images?.[0]?.url ?? null,
          });
        } else {
          setNowPlaying(null);
        }
      } else {
        setNowPlaying(null);
      }
    } catch {
      setNowPlaying(null);
    }

    // Recently played
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const tracks: RecentTrack[] = (data.items ?? []).map((item: any) => ({
          id: item.played_at,
          trackName: item.track.name,
          artistName: item.track.artists.map((a: any) => a.name).join(', '),
          albumArt: item.track.album?.images?.[1]?.url ?? item.track.album?.images?.[0]?.url ?? null,
          playedAt: item.played_at,
          spotifyUrl: item.track.external_urls?.spotify ?? '',
        }));
        setRecentTracks(tracks);
      }
    } catch {
      // keep cached data
    } finally {
      setLoadingRecent(false);
    }
  }, [getValidToken]);

  useEffect(() => {
    fetchSpotifyData();
    const interval = setInterval(fetchSpotifyData, 30_000);
    return () => clearInterval(interval);
  }, [fetchSpotifyData]);

  // Validation & save
  const validate = (): boolean => {
    const e: Partial<UserProfile> = {};
    if (!profile.fullName.trim()) e.fullName = 'El nombre es obligatorio';
    if (!profile.age.trim()) {
      e.age = 'La edad es obligatoria';
    } else {
      const n = parseInt(profile.age, 10);
      if (isNaN(n) || n < 13 || n > 99) e.age = 'Ingresa una edad entre 13 y 99';
    }
    if (!profile.gender) e.gender = 'Selecciona una opción';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setProfileSaved(true);
    setIsEditing(false);
  };

  return (
    <Container>
      <LinearGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.6 }}
      />
      <StyledSafeArea>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 18, paddingBottom: 120 }}
          >

            {/* ── SECCIÓN 1: HEADER ─────────────────────────── */}
            <HeaderRow>
              <HeaderLeft>
                <AvatarWrap>
                  {spotifyUser?.avatar ? (
                    <AvatarImg source={{ uri: spotifyUser.avatar }} />
                  ) : (
                    <AvatarPlaceholder>
                      <Ionicons name="person" size={36} color="#F366FF" />
                    </AvatarPlaceholder>
                  )}
                </AvatarWrap>
                <UserInfoCol>
                  <UserNameText numberOfLines={1}>
                    {displayUser?.name ?? 'Encorely User'}
                  </UserNameText>
                  <VibeBadge>
                    <VibeBadgeText>✦ Encorely Vibe Explorer</VibeBadgeText>
                  </VibeBadge>
                </UserInfoCol>
              </HeaderLeft>
              <SettingsBtn onPress={() => router.push('/(main)/settings')}>
                <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.7)" />
              </SettingsBtn>
            </HeaderRow>

            {/* ── SECCIÓN 2: DATOS DE PERFIL ────────────────── */}
            <GlassCard intensity={20} tint="dark">
              <CardInner>
                <SectionLabel>
                  {isEditing && !profileSaved ? 'Completa tu perfil' : 'Datos de perfil'}
                </SectionLabel>

                {isEditing ? (
                  <>
                    {!profileSaved && (
                      <CTAText>
                        Completa tu perfil para aparecer en el Radar 🎵
                      </CTAText>
                    )}

                    {/* Nombre completo */}
                    <FieldLabel>Nombre completo *</FieldLabel>
                    <StyledInput
                      placeholder="Tu nombre completo"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={profile.fullName}
                      onChangeText={(t: string) => setProfile(p => ({ ...p, fullName: t }))}
                      autoCapitalize="words"
                    />
                    {errors.fullName ? <ErrorText>{errors.fullName}</ErrorText> : null}

                    {/* Edad */}
                    <FieldLabel>Edad *</FieldLabel>
                    <StyledInput
                      placeholder="ej. 24"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={profile.age}
                      onChangeText={(t: string) => setProfile(p => ({ ...p, age: t.replace(/[^0-9]/g, '') }))}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                    {errors.age ? <ErrorText>{errors.age}</ErrorText> : null}

                    {/* Género */}
                    <FieldLabel>Género *</FieldLabel>
                    <GenderRow>
                      {GENDER_OPTIONS.map((opt) => (
                        <GenderChip
                          key={opt}
                          selected={profile.gender === opt}
                          onPress={() => setProfile(p => ({ ...p, gender: opt }))}
                          activeOpacity={0.7}
                        >
                          <GenderChipText selected={profile.gender === opt}>{opt}</GenderChipText>
                        </GenderChip>
                      ))}
                    </GenderRow>
                    {errors.gender ? <ErrorText>{errors.gender}</ErrorText> : null}

                    {/* Descripción */}
                    <FieldLabel>Descripción (opcional)</FieldLabel>
                    <TextAreaInput
                      placeholder="Cuéntale a la comunidad quién eres... 🎵"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={profile.description}
                      onChangeText={(t: string) => setProfile(p => ({ ...p, description: t.slice(0, 150) }))}
                      multiline
                      numberOfLines={3}
                      maxLength={150}
                    />
                    <CharCount>{profile.description.length}/150</CharCount>

                    <SaveButton onPress={handleSave} activeOpacity={0.8}>
                      <SaveButtonText>Guardar perfil</SaveButtonText>
                    </SaveButton>
                  </>
                ) : (
                  <>
                    <ReadField>
                      <ReadLabel>Nombre completo</ReadLabel>
                      <ReadValue>{profile.fullName}</ReadValue>
                    </ReadField>
                    <ReadField>
                      <ReadLabel>Edad</ReadLabel>
                      <ReadValue>{profile.age} años</ReadValue>
                    </ReadField>
                    <ReadField>
                      <ReadLabel>Género</ReadLabel>
                      <ReadValue>{profile.gender}</ReadValue>
                    </ReadField>
                    {profile.description ? (
                      <ReadField>
                        <ReadLabel>Sobre mí</ReadLabel>
                        <ReadValue style={{ lineHeight: 22, color: 'rgba(255,255,255,0.8)' }}>
                          {profile.description}
                        </ReadValue>
                      </ReadField>
                    ) : null}
                    <EditButton onPress={() => setIsEditing(true)} activeOpacity={0.7}>
                      <EditButtonText>Editar perfil</EditButtonText>
                    </EditButton>
                  </>
                )}
              </CardInner>
            </GlassCard>

            {/* ── SECCIÓN 3: REPRODUCIENDO AHORA ───────────── */}
            {nowPlaying && (
              <NowPlayingPill intensity={30} tint="dark">
                <NowPlayingInner>
                  <PulsingIcon />
                  <NowPlayingInfo>
                    <NowPlayingTrack numberOfLines={1}>{nowPlaying.trackName}</NowPlayingTrack>
                    <NowPlayingArtist numberOfLines={1}>{nowPlaying.artistName}</NowPlayingArtist>
                    <SpotifyBadge>
                      <Ionicons name="musical-note" size={12} color="#1DB954" />
                      <SpotifyBadgeText>Reproduciendo ahora</SpotifyBadgeText>
                    </SpotifyBadge>
                  </NowPlayingInfo>
                  {nowPlaying.albumArt ? (
                    <Image
                      source={{ uri: nowPlaying.albumArt }}
                      style={{ width: 44, height: 44, borderRadius: 8 }}
                    />
                  ) : null}
                </NowPlayingInner>
              </NowPlayingPill>
            )}

            {/* ── SECCIÓN 4: REPRODUCCIONES RECIENTES ──────── */}
            {(loadingRecent || recentTracks.length > 0) && (
              <>
                <RecentHeader>
                  <RecentTitle>Reproducciones recientes</RecentTitle>
                  <VerMasBtn
                    onPress={() =>
                      Linking.openURL(`https://open.spotify.com/user/${spotifyUser?.id ?? ''}`)
                    }
                    activeOpacity={0.7}
                  >
                    <VerMasText>Ver más →</VerMasText>
                  </VerMasBtn>
                </RecentHeader>

                <RecentCard intensity={20} tint="dark">
                  {loadingRecent ? (
                    <View style={{ padding: 32, alignItems: 'center' }}>
                      <ActivityIndicator color="#F366FF" />
                    </View>
                  ) : (
                    recentTracks.slice(0, 10).map((track, idx) => (
                      <React.Fragment key={track.id}>
                        <TrackRow
                          onPress={() =>
                            track.spotifyUrl ? Linking.openURL(track.spotifyUrl) : null
                          }
                          activeOpacity={0.7}
                        >
                          {track.albumArt ? (
                            <AlbumArt source={{ uri: track.albumArt }} />
                          ) : (
                            <AlbumArtPlaceholder>
                              <Ionicons name="musical-note" size={20} color="#F366FF" />
                            </AlbumArtPlaceholder>
                          )}
                          <TrackInfo>
                            <TrackName numberOfLines={1}>{track.trackName}</TrackName>
                            <TrackArtist numberOfLines={1}>{track.artistName}</TrackArtist>
                          </TrackInfo>
                          <TimePill>
                            <TimePillText>{timeAgo(track.playedAt)}</TimePillText>
                          </TimePill>
                        </TrackRow>
                        {idx < recentTracks.slice(0, 10).length - 1 && (
                          <TrackSeparator />
                        )}
                      </React.Fragment>
                    ))
                  )}
                </RecentCard>
              </>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </StyledSafeArea>
    </Container>
  );
}
