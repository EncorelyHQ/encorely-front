import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { ScreenShell } from '@/layout';
import { Ionicons } from '@expo/vector-icons';
import { useSpotifyAuth } from '@/shared/hooks/useSpotifyAuth';
import { searchArtists, type SpotifyArtistSearchItem } from '@/clients/spotify/spotifyApi';
import { useOnboarding } from '@/shared/context/OnboardingContext';
import { SPOTIFY_SEED_GENRES } from '@/config/onboarding';

const BackBtn = styled.TouchableOpacity`
  padding: 8px;
  margin-bottom: 8px;
  align-self: flex-start;
`;

const Title = styled.Text`
  color: #fff;
  font-size: 24px;
  font-family: 'GolosText_700Bold';
  margin-bottom: 8px;
`;

const Sub = styled.Text`
  color: rgba(255, 255, 255, 0.55);
  font-size: 14px;
  font-family: 'Inter_500Medium';
  line-height: 20px;
  margin-bottom: 20px;
`;

const SearchRow = styled.View`
  flex-direction: row;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding-horizontal: 12px;
  margin-bottom: 12px;
`;

const Chip = styled.TouchableOpacity<{ selected?: boolean }>`
  padding-horizontal: 12px;
  padding-vertical: 8px;
  border-radius: 99px;
  margin: 4px;
  background-color: ${(p: { selected?: boolean }) =>
    p.selected ? 'rgba(243, 102, 255, 0.35)' : 'rgba(255,255,255,0.06)'};
  border-width: 1px;
  border-color: ${(p: { selected?: boolean }) =>
    p.selected ? '#F366FF' : 'rgba(255,255,255,0.1)'};
`;

const ChipText = styled.Text<{ selected?: boolean }>`
  color: ${(p: { selected?: boolean }) => (p.selected ? '#fff' : 'rgba(255,255,255,0.75)')};
  font-size: 13px;
  font-family: 'Inter_500Medium';
`;

const PrimaryBtn = styled.TouchableOpacity<{ disabled?: boolean }>`
  background-color: ${(p: { disabled?: boolean }) =>
    p.disabled ? 'rgba(243, 102, 255, 0.25)' : '#f366ff'};
  padding-vertical: 16px;
  border-radius: 99px;
  align-items: center;
  margin-top: 20px;
`;

const PrimaryTxt = styled.Text`
  color: #fff;
  font-size: 16px;
  font-family: 'GolosText_700Bold';
`;

type PickedArtist = { id: string; name: string };

export default function OnboardingStep5Screen() {
  const router = useRouter();
  const { accessToken, getValidToken } = useSpotifyAuth();
  const { preferences, savePreferences } = useOnboarding();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SpotifyArtistSearchItem[]>([]);
  const [artists, setArtists] = useState<PickedArtist[]>(() => preferences.artists ?? []);
  const [genres, setGenres] = useState<string[]>(preferences.genres);
  const [genreFilter, setGenreFilter] = useState('');

  const mergedArtists = useMemo(() => {
    const byId = new Map<string, PickedArtist>();
    for (const a of artists) byId.set(a.id, a);
    return Array.from(byId.values());
  }, [artists]);

  const runSearch = useCallback(async () => {
    const token = accessToken ?? (await getValidToken());
    if (!token || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const found = await searchArtists(token, query.trim(), 15);
      setResults(found);
    } catch (e) {
      console.warn('[OnboardingStep5] search failed', e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [accessToken, getValidToken, query]);

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].slice(0, 5)
    );
  };

  const addArtist = (a: SpotifyArtistSearchItem) => {
    if (mergedArtists.some((x) => x.id === a.id)) return;
    if (mergedArtists.length >= 5) {
      Alert.alert('Límite', 'Podés elegir hasta 5 artistas.');
      return;
    }
    setArtists((prev) => [...prev, { id: a.id, name: a.name }]);
  };

  const removeArtist = (id: string) => {
    setArtists((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredGenres = useMemo(() => {
    const f = genreFilter.trim().toLowerCase();
    if (!f) return [...SPOTIFY_SEED_GENRES].slice(0, 48);
    return SPOTIFY_SEED_GENRES.filter((g) => g.toLowerCase().includes(f)).slice(0, 60);
  }, [genreFilter]);

  const canContinue = mergedArtists.length > 0 || genres.length > 0;

  const onContinue = async () => {
    if (!canContinue) {
      Alert.alert('Elegí gustos', 'Seleccioná al menos un artista o un género.');
      return;
    }
    await savePreferences({
      artists: mergedArtists.map((a) => ({ id: a.id, name: a.name })),
      genres,
    });
    router.push('/(onboarding)/step-6');
  };

  return (
    <ScreenShell centerContent={false} gradientOpacity={0.65} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <BackBtn onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </BackBtn>
        <Title>Gustos musicales</Title>
        <Sub>
          Elegí hasta 5 artistas y hasta 5 géneros (semillas válidas para recomendaciones de Spotify).
        </Sub>

        <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium', marginBottom: 8 }}>
          Buscar artistas
        </Text>
        <SearchRow>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre del artista"
            placeholderTextColor="rgba(255,255,255,0.35)"
            onSubmitEditing={runSearch}
            style={{
              flex: 1,
              color: '#fff',
              paddingVertical: 14,
              fontFamily: 'Inter_500Medium',
            }}
          />
          <TouchableOpacity onPress={runSearch} style={{ padding: 8 }}>
            {searching ? (
              <ActivityIndicator color="#F366FF" size="small" />
            ) : (
              <Ionicons name="search" size={22} color="#F366FF" />
            )}
          </TouchableOpacity>
        </SearchRow>

        {results.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            {results.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => addArtist(a)}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <Text style={{ color: '#fff', fontFamily: 'GolosText_600SemiBold' }}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {mergedArtists.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
            {mergedArtists.map((a) => (
              <Chip
                key={a.id}
                selected
                onPress={() => removeArtist(a.id)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ marginRight: 6 }}>
                  <ChipText selected>{a.name}</ChipText>
                </View>
                <Ionicons name="close-circle" size={16} color="#fff" />
              </Chip>
            ))}
          </View>
        ) : null}

        <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium', marginBottom: 8 }}>
          Géneros ({genres.length}/5)
        </Text>
        <TextInput
          value={genreFilter}
          onChangeText={setGenreFilter}
          placeholder="Filtrar géneros…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            color: '#fff',
            marginBottom: 12,
            fontFamily: 'Inter_500Medium',
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
          {filteredGenres.map((g) => (
            <Chip key={g} selected={genres.includes(g)} onPress={() => toggleGenre(g)}>
              <ChipText selected={genres.includes(g)}>{g}</ChipText>
            </Chip>
          ))}
        </View>

        <PrimaryBtn disabled={!canContinue} onPress={onContinue}>
          <PrimaryTxt>Continuar al swipe</PrimaryTxt>
        </PrimaryBtn>
        <Text
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            fontFamily: 'Inter_500Medium',
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          Paso 5 de 6
        </Text>
      </ScrollView>
    </ScreenShell>
  );
}
