/**
 * ProfileScreen — Encorely
 * Secciones: Hero | Now Playing | Music DNA | Recently Played
 *
 * victory-native REMOVIDO → causa cuelgue en Expo Go.
 * Usamos implementación SVG nativa custom para el radar chart.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/shared/context/AuthContext';
import { useSpotifyAuth } from '@/shared/context/SpotifyAuthContext';
import type { VibeVector } from '@/shared/types/vibe';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  fullName: string;
  age: string;
  gender: string;
  description: string;
}

interface NowPlaying {
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

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} d`;
}

function getVibeTags(v: VibeVector): string[] {
  const tags: string[] = [];
  if (v.energy > 0.7) tags.push('High Energy');
  if (v.energy < 0.4) tags.push('Chill');
  if (v.valence > 0.6) tags.push('Happy');
  if (v.valence < 0.4) tags.push('Dark Vibes');
  if (v.danceability > 0.7) tags.push('Dance Mode');
  if (v.tempo > 0.65) tags.push('Fast Beats');
  if (tags.length === 0) tags.push('Eclectic');
  return tags;
}

const PROFILE_KEY = 'encorely_user_profile';

// ─── Styled Components ────────────────────────────────────────────────────────

const BG = styled.View`
  flex: 1;
  background-color: #181818;
`;

const StyledSafe = styled(SafeAreaView)`
  flex: 1;
`;

// — Hero —
const HeroWrap = styled.View`
  align-items: center;
  padding: 20px 22px 0;
  position: relative;
`;

const SettingsBtn = styled.TouchableOpacity`
  position: absolute;
  top: 20px;
  right: 22px;
  width: 38px;
  height: 38px;
  border-radius: 19px;
  background-color: rgba(255, 255, 255, 0.07);
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  align-items: center;
  justify-content: center;
`;

const AvatarRing = styled.View`
  width: 94px;
  height: 94px;
  border-radius: 47px;
  border-width: 2px;
  border-color: #f366ff;
  padding: 2px;
  margin-bottom: 14px;
`;

const AvatarImg = styled.Image`
  width: 86px;
  height: 86px;
  border-radius: 43px;
  background-color: rgba(243, 102, 255, 0.15);
`;

const AvatarFallback = styled.View`
  width: 86px;
  height: 86px;
  border-radius: 43px;
  background-color: rgba(243, 102, 255, 0.15);
  align-items: center;
  justify-content: center;
`;

const UserName = styled.Text`
  color: #ffffff;
  font-size: 22px;
  font-family: 'GolosText_700Bold';
  text-align: center;
  margin-bottom: 8px;
`;

const VibeBadge = styled.View`
  background-color: rgba(243, 102, 255, 0.15);
  border-radius: 99px;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.35);
  padding-horizontal: 14px;
  padding-vertical: 5px;
  margin-bottom: 12px;
`;

const VibeBadgeText = styled.Text`
  color: #f366ff;
  font-size: 11px;
  font-family: 'Inter_500Medium';
  letter-spacing: 0.5px;
`;

const ProfileDataRow = styled.Text`
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  text-align: center;
  margin-bottom: 4px;
`;

const ProfileDescription = styled.Text`
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  font-family: 'Inter_500Medium';
  text-align: center;
  line-height: 20px;
  max-width: 280px;
  margin-bottom: 4px;
`;

const CompleteProfileBtn = styled.TouchableOpacity`
  margin-top: 4px;
  margin-bottom: 8px;
`;

const CompleteProfileText = styled.Text`
  color: #f366ff;
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

// — Cards —
const Section = styled.View`
  padding: 0 22px;
  gap: 14px;
`;

const GlassCard = styled(BlurView)`
  border-radius: 24px;
  overflow: hidden;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.07);
  background-color: rgba(255, 255, 255, 0.03);
`;

const CardPad = styled.View`
  padding: 18px 20px;
`;

const CardTitle = styled.Text`
  color: #ffffff;
  font-size: 16px;
  font-family: 'GolosText_700Bold';
  margin-bottom: 14px;
`;

// — Now Playing —
const NowPlayingPill = styled(BlurView)`
  border-radius: 50px;
  overflow: hidden;
  margin: 0 22px;
  border-width: 1px;
  border-color: rgba(243, 102, 255, 0.25);
  background-color: rgba(255, 255, 255, 0.03);
`;

const NowPlayingRow = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 12px 20px;
  gap: 14px;
`;

const NowPlayingInfo = styled.View`
  flex: 1;
`;

const NowPlayingTrack = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-family: 'GolosText_700Bold';
`;

const NowPlayingArtist = styled.Text`
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-top: 1px;
`;

const SpotifyRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
`;

const SpotifyLabel = styled.Text`
  color: #1db954;
  font-size: 11px;
  font-family: 'Inter_500Medium';
`;

// — Radar / DNA —
const TagsRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`;

const VibePill = styled.View`
  background-color: rgba(163, 85, 247, 0.15);
  border-radius: 99px;
  border-width: 1px;
  border-color: rgba(163, 85, 247, 0.4);
  padding-horizontal: 12px;
  padding-vertical: 6px;
`;

const VibePillText = styled.Text`
  color: #a855f7;
  font-size: 12px;
  font-family: 'Inter_500Medium';
`;

// — Recent tracks —
const SectionHeaderRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
`;

const VerMasText = styled.Text`
  color: #f366ff;
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

const TrackRow = styled.TouchableOpacity`
  flex-direction: row;
  align-items: center;
  padding: 13px 16px;
  gap: 14px;
`;

const TrackSep = styled.View`
  height: 1px;
  background-color: rgba(255, 255, 255, 0.06);
  margin-left: 78px;
`;

const AlbumCover = styled.Image`
  width: 48px;
  height: 48px;
  border-radius: 8px;
`;

const AlbumFallback = styled.View`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.08);
  align-items: center;
  justify-content: center;
`;

const TrackMeta = styled.View`
  flex: 1;
`;

const TrackTitle = styled.Text`
  color: #ffffff;
  font-size: 14px;
  font-family: 'GolosText_700Bold';
`;

const TrackArtist = styled.Text`
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  font-family: 'Inter_500Medium';
  margin-top: 2px;
`;

const TimeBubble = styled.View`
  background-color: rgba(255, 255, 255, 0.07);
  border-radius: 99px;
  padding-horizontal: 10px;
  padding-vertical: 5px;
`;

const TimeBubbleText = styled.Text`
  color: #f366ff;
  font-size: 11px;
  font-family: 'Inter_500Medium';
`;

const EmptyText = styled.Text`
  color: rgba(255, 255, 255, 0.3);
  font-family: 'Inter_500Medium';
  font-size: 14px;
  text-align: center;
  padding: 24px;
`;

// ─── Pulsing Icon ─────────────────────────────────────────────────────────────

function PulsingHeadset() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.65, duration: 800, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <Ionicons name="headset" size={26} color="#F366FF" />
    </Animated.View>
  );
}

// ─── Custom Radar Chart ───────────────────────────────────────────────────────

function RadarChart({ vibeVector }: { vibeVector: VibeVector }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, []);

  const safe = (v: any, fallback = 0.5): number => {
    const n = Number(v);
    return isNaN(n) ? fallback : Math.max(0, Math.min(1, n));
  };

  const dims = [
    { label: 'Energy', value: safe(vibeVector.energy), color: '#F366FF' },
    { label: 'Dance', value: safe(vibeVector.danceability), color: '#A855F7' },
    { label: 'Valence', value: safe(vibeVector.valence), color: '#8B5CF6' },
    { label: 'Tempo', value: safe(vibeVector.tempo), color: '#EC4899' },
  ];

  const SIZE = 200;
  const CENTER = SIZE / 2;
  const MAX_R = SIZE * 0.37;

  return (
    <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <View
            key={ring}
            style={{
              position: 'absolute',
              width: MAX_R * 2 * ring,
              height: MAX_R * 2 * ring,
              borderRadius: MAX_R * ring,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
            }}
          />
        ))}
        {dims.map((dim, i) => {
          const angle = i * 90 - 90;
          const rad = (angle * Math.PI) / 180;
          const barLength = MAX_R * dim.value;
          const dotX = CENTER - 4 + barLength * Math.cos(rad);
          const dotY = CENTER - 4 + barLength * Math.sin(rad);

          return (
            <React.Fragment key={dim.label}>
              <View
                style={{
                  position: 'absolute',
                  width: 1,
                  height: MAX_R,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  bottom: CENTER,
                  left: CENTER - 0.5,
                  transformOrigin: 'bottom',
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 4,
                  height: barLength,
                  backgroundColor: dim.color,
                  bottom: CENTER,
                  left: CENTER - 2,
                  borderRadius: 2,
                  transformOrigin: 'bottom',
                  transform: [{ rotate: `${angle}deg` }],
                  shadowColor: dim.color,
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: dim.color,
                  left: dotX,
                  top: dotY,
                  shadowColor: dim.color,
                  shadowOpacity: 1,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              />
            </React.Fragment>
          );
        })}
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#F366FF',
            shadowColor: '#F366FF',
            shadowOpacity: 0.9,
            shadowRadius: 10,
            elevation: 4,
          }}
        />
      </View>

      {/* Labels */}
      <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
        {dims.map((d) => (
          <View key={d.label} style={{ alignItems: 'center' }}>
            <Text style={{ color: d.color, fontSize: 11, fontFamily: 'Inter_500Medium' }}>
              {d.label}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'Inter_500Medium' }}>
              {Math.round(d.value * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { vibeVector } = useAuth();
  const { user: spotifyUser, getValidToken } = useSpotifyAuth();

  // Saved profile
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Spotify data
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Load AsyncStorage profile
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((raw) => {
      if (raw) setProfile(JSON.parse(raw));
    });
  }, []);

  // Spotify fetch
  const fetchSpotify = useCallback(async () => {
    const token = await getValidToken();
    if (!token) return;

    // Currently playing
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data?.is_playing && data?.item) {
          setNowPlaying({
            trackName: data.item.name,
            artistName: data.item.artists.map((a: { name: string }) => a.name).join(', '),
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
        const tracks: RecentTrack[] = (data.items ?? []).map((item: {
          played_at: string;
          track: {
            name: string;
            artists: { name: string }[];
            album: { images: { url: string }[] };
            external_urls: { spotify: string };
          };
        }) => ({
          id: item.played_at,
          trackName: item.track.name,
          artistName: item.track.artists.map((a) => a.name).join(', '),
          albumArt: item.track.album?.images?.[1]?.url ?? item.track.album?.images?.[0]?.url ?? null,
          playedAt: item.played_at,
          spotifyUrl: item.track.external_urls?.spotify ?? '',
        }));
        setRecentTracks(tracks);
      }
    } catch {
      // keep cached
    } finally {
      setLoadingRecent(false);
    }
  }, [getValidToken]);

  useEffect(() => {
    fetchSpotify();
    const interval = setInterval(fetchSpotify, 30_000);
    return () => clearInterval(interval);
  }, [fetchSpotify]);

  const hasProfileData = profile && (profile.fullName || profile.age || profile.gender);

  return (
    <BG>
      <LinearGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', inset: 0, opacity: 0.55 }}
      />
      <StyledSafe>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 18, paddingBottom: 120 }}
        >
          {/* ── BLOQUE 1: HERO ──────────────────────────────────────────── */}
          <HeroWrap>
            <SettingsBtn onPress={() => router.push('/(main)/settings')} activeOpacity={0.75}>
              <Ionicons name="settings-outline" size={19} color="rgba(255,255,255,0.65)" />
            </SettingsBtn>

            <AvatarRing>
              {spotifyUser?.avatar ? (
                <AvatarImg source={{ uri: spotifyUser.avatar }} />
              ) : (
                <AvatarFallback>
                  <Ionicons name="person" size={38} color="#F366FF" />
                </AvatarFallback>
              )}
            </AvatarRing>

            <UserName>{spotifyUser?.name ?? 'Encorely User'}</UserName>

            <VibeBadge>
              <VibeBadgeText>✦ Vibe Explorer</VibeBadgeText>
            </VibeBadge>

            {/* Datos de perfil sutiles */}
            {hasProfileData ? (
              <>
                {(profile!.age || profile!.gender) ? (
                  <ProfileDataRow>
                    {[profile!.age ? `${profile!.age} años` : '', profile!.gender]
                      .filter(Boolean)
                      .join(' • ')}
                  </ProfileDataRow>
                ) : null}
                {profile!.description ? (
                  <ProfileDescription numberOfLines={2}>{profile!.description}</ProfileDescription>
                ) : null}
              </>
            ) : (
              <CompleteProfileBtn onPress={() => router.push('/(main)/settings')} activeOpacity={0.7}>
                <CompleteProfileText>Completa tu perfil →</CompleteProfileText>
              </CompleteProfileBtn>
            )}
          </HeroWrap>

          {/* ── BLOQUE 2: REPRODUCIENDO AHORA ───────────────────────────── */}
          {nowPlaying && (
            <NowPlayingPill intensity={25} tint="dark">
              <NowPlayingRow>
                <PulsingHeadset />
                <NowPlayingInfo>
                  <NowPlayingTrack numberOfLines={1}>{nowPlaying.trackName}</NowPlayingTrack>
                  <NowPlayingArtist numberOfLines={1}>{nowPlaying.artistName}</NowPlayingArtist>
                  <SpotifyRow>
                    <Ionicons name="ellipse" size={8} color="#1DB954" />
                    <SpotifyLabel>Reproduciendo ahora en Spotify</SpotifyLabel>
                  </SpotifyRow>
                </NowPlayingInfo>
                {nowPlaying.albumArt && (
                  <Image
                    source={{ uri: nowPlaying.albumArt }}
                    style={{ width: 42, height: 42, borderRadius: 8 }}
                  />
                )}
              </NowPlayingRow>
            </NowPlayingPill>
          )}

          {/* ── BLOQUE 3: MUSIC DNA ─────────────────────────────────────── */}
          <Section>
            <GlassCard intensity={20} tint="dark">
              <CardPad>
                <CardTitle>Tu Music DNA</CardTitle>
                {vibeVector ? (
                  <>
                    <RadarChart vibeVector={vibeVector} />
                    <TagsRow>
                      {getVibeTags(vibeVector).map((tag) => (
                        <VibePill key={tag}>
                          <VibePillText>{tag}</VibePillText>
                        </VibePill>
                      ))}
                    </TagsRow>
                  </>
                ) : (
                  <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#F366FF" />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                      Calculando tu ADN musical...
                    </Text>
                  </View>
                )}
              </CardPad>
            </GlassCard>
          </Section>

          {/* ── BLOQUE 4: REPRODUCCIONES RECIENTES ─────────────────────── */}
          <Section>
            <SectionHeaderRow>
              <CardTitle style={{ marginBottom: 0 }}>Reproducciones recientes</CardTitle>
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://open.spotify.com/user/${spotifyUser?.id ?? ''}`)}
                activeOpacity={0.7}
              >
                <VerMasText>Ver más →</VerMasText>
              </TouchableOpacity>
            </SectionHeaderRow>

            <GlassCard intensity={20} tint="dark">
              {loadingRecent ? (
                <View style={{ padding: 28, alignItems: 'center' }}>
                  <ActivityIndicator color="#F366FF" />
                </View>
              ) : recentTracks.length === 0 ? (
                <EmptyText>Aún no tienes reproducciones recientes 🎵</EmptyText>
              ) : (
                recentTracks.map((track, idx) => (
                  <React.Fragment key={track.id}>
                    <TrackRow
                      onPress={() => track.spotifyUrl && Linking.openURL(track.spotifyUrl)}
                      activeOpacity={0.7}
                    >
                      {track.albumArt ? (
                        <AlbumCover source={{ uri: track.albumArt }} />
                      ) : (
                        <AlbumFallback>
                          <Ionicons name="musical-note" size={20} color="rgba(255,255,255,0.4)" />
                        </AlbumFallback>
                      )}
                      <TrackMeta>
                        <TrackTitle numberOfLines={1}>{track.trackName}</TrackTitle>
                        <TrackArtist numberOfLines={1}>{track.artistName}</TrackArtist>
                      </TrackMeta>
                      <TimeBubble>
                        <TimeBubbleText>{timeAgo(track.playedAt)}</TimeBubbleText>
                      </TimeBubble>
                    </TrackRow>
                    {idx < recentTracks.length - 1 && <TrackSep />}
                  </React.Fragment>
                ))
              )}
            </GlassCard>
          </Section>
        </ScrollView>
      </StyledSafe>
    </BG>
  );
}
