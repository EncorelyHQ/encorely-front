import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_SWIPE_THRESHOLD } from '@/config/api';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { useEventsFeed } from '@/modules/radar/hooks/useEventsFeed';
import { useRadarMatches } from '@/modules/radar/hooks/useRadarMatches';
import type { EventFeedItem } from '@/clients/encorely/types';

const Container = styled.View`
  flex: 1;
  background-color: ${({ theme }: { theme?: { colors: { background: string } } }) =>
    theme?.colors?.background ?? '#181818'};
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
`;

const GlassCard = styled(BlurView)`
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.08);
  background-color: rgba(255, 255, 255, 0.04);
`;

const Title = styled.Text`
  font-size: 28px;
  font-family: GolosText_900Black;
  color: #fff;
  margin-bottom: 8px;
`;

const Subtitle = styled.Text`
  font-size: 14px;
  font-family: Inter_500Medium;
  color: rgba(255, 255, 255, 0.55);
  line-height: 22px;
  margin-bottom: 16px;
`;

export default function RadarScreen() {
  const router = useRouter();
  const { profile } = useEncorelyAuth();
  const swipeCount = profile?.swipeCount ?? 0;
  const canUseRadar = swipeCount >= API_SWIPE_THRESHOLD;

  const { events, loading: eventsLoading, error: eventsError, reload: reloadEvents } =
    useEventsFeed();
  const {
    matches,
    loading: matchesLoading,
    error: matchesError,
    thresholdBlocked,
    loadMatches,
    clearMatches,
  } = useRadarMatches();

  const [selectedEvent, setSelectedEvent] = useState<EventFeedItem | null>(null);

  const handleSelectEvent = (event: EventFeedItem) => {
    setSelectedEvent(event);
    clearMatches();
    void loadMatches(event.id);
  };

  return (
    <Container>
      <BackgroundGradient
        colors={['#181818', '#2a1a3a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StyledSafeArea>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Title>Radar Social</Title>
          <Subtitle>
            {canUseRadar
              ? 'Elegí un evento y descubrí personas con afinidad musical.'
              : `Necesitás al menos ${API_SWIPE_THRESHOLD} swipes (${swipeCount}/${API_SWIPE_THRESHOLD}).`}
          </Subtitle>

          {!canUseRadar ? (
            <GlassCard intensity={30} tint="dark">
              <Text style={{ color: '#F366FF', fontFamily: 'Inter_500Medium' }}>
                Seguí en Sound-Swipe para desbloquear el radar.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 16 }}
                onPress={() => router.replace('/(main)')}
              >
                <Text style={{ color: '#fff', fontFamily: 'GolosText_700Bold' }}>
                  Ir a swipes →
                </Text>
              </TouchableOpacity>
            </GlassCard>
          ) : null}

          {canUseRadar && (
            <>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  fontFamily: 'GolosText_700Bold',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Eventos
              </Text>

              {eventsLoading ? (
                <ActivityIndicator color="#F366FF" style={{ marginVertical: 24 }} />
              ) : eventsError ? (
                <GlassCard intensity={30} tint="dark">
                  <Text style={{ color: '#ff6b6b', fontFamily: 'Inter_500Medium' }}>
                    {eventsError}
                  </Text>
                  <TouchableOpacity onPress={() => void reloadEvents()} style={{ marginTop: 12 }}>
                    <Text style={{ color: '#F366FF' }}>Reintentar</Text>
                  </TouchableOpacity>
                </GlassCard>
              ) : (
                events.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.85}
                    onPress={() => handleSelectEvent(event)}
                  >
                    <GlassCard
                      intensity={30}
                      tint="dark"
                      style={{
                        borderColor:
                          selectedEvent?.id === event.id ? '#F366FF' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: '#fff', fontFamily: 'GolosText_700Bold', fontSize: 16 }}>
                        {event.name}
                      </Text>
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.5)',
                          fontFamily: 'Inter_500Medium',
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      >
                        {event.venue} · {event.mood}
                      </Text>
                    </GlassCard>
                  </TouchableOpacity>
                ))
              )}

              {selectedEvent ? (
                <>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      fontSize: 12,
                      fontFamily: 'GolosText_700Bold',
                      marginTop: 16,
                      marginBottom: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Candidatos
                  </Text>

                  {matchesLoading ? (
                    <ActivityIndicator color="#F366FF" />
                  ) : thresholdBlocked ? (
                    <GlassCard intensity={30} tint="dark">
                      <Text style={{ color: '#F366FF', fontFamily: 'Inter_500Medium' }}>
                        Completá {API_SWIPE_THRESHOLD} swipes para ver matches en este evento.
                      </Text>
                    </GlassCard>
                  ) : matchesError ? (
                    <GlassCard intensity={30} tint="dark">
                      <Text style={{ color: '#ff6b6b' }}>{matchesError}</Text>
                    </GlassCard>
                  ) : matches.length === 0 ? (
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_500Medium' }}>
                      No hay candidatos por ahora.
                    </Text>
                  ) : (
                    matches.map((candidate) => (
                      <TouchableOpacity
                        key={candidate.id}
                        activeOpacity={0.85}
                        onPress={() =>
                          router.push({
                            pathname: '/(main)/chat/[id]',
                            params: { id: candidate.id, name: candidate.displayName },
                          })
                        }
                      >
                        <GlassCard intensity={30} tint="dark">
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{ color: '#fff', fontFamily: 'GolosText_700Bold' }}
                              >
                                {candidate.displayName}
                              </Text>
                              <Text
                                style={{
                                  color: 'rgba(255,255,255,0.5)',
                                  fontFamily: 'Inter_500Medium',
                                  fontSize: 12,
                                }}
                              >
                                {candidate.mood}
                                {candidate.isHighPriority ? ' · Prioridad alta' : ''}
                              </Text>
                            </View>
                            <Text style={{ color: '#F366FF', fontFamily: 'GolosText_700Bold' }}>
                              {Math.round(candidate.affinity * 100)}%
                            </Text>
                          </View>
                        </GlassCard>
                      </TouchableOpacity>
                    ))
                  )}
                </>
              ) : null}

              <TouchableOpacity
                style={{ marginTop: 24, alignSelf: 'center' }}
                onPress={() => router.push('/(main)/matches')}
              >
                <Text style={{ color: '#F366FF', fontFamily: 'GolosText_700Bold' }}>
                  Ver matches pendientes →
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </StyledSafeArea>
    </Container>
  );
}
