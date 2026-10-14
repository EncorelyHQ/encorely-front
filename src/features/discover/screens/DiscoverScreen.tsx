import { useCallback, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useIsFocused } from 'expo-router'
import { meApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import type { SwipeDirection } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { EmptyState, ErrorState, Screen, space, Text, useStyles, VinylRecordIcon, type Theme } from '@/ui'
import { DeckSkeleton } from '../components/DeckSkeleton'
import { DiscoverActions } from '../components/DiscoverActions'
import { RadarProgress, RadarUnlocked } from '../components/RadarProgress'
import { SwipeDeck, type DeckHandle } from '../components/SwipeDeck'
import { useAppActive, useScreenReaderEnabled } from '../hooks/useAppActive'
import { usePreviewAudio } from '../hooks/usePreviewAudio'
import { useSongQueue } from '../hooks/useSongQueue'

const UNLOCKED_COPY = 'Listo. Ya puedes ver quién va a tus conciertos.'

export function DiscoverScreen() {
  const styles = useStyles(makeStyles)
  const deck = useRef<DeckHandle>(null)
  const [unlockedNotice, setUnlockedNotice] = useState(false)

  const onRadarUnlocked = useCallback(() => {
    setUnlockedNotice(true)
    AccessibilityInfo.announceForAccessibility(UNLOCKED_COPY)
  }, [])

  const queue = useSongQueue({ onRadarUnlocked })
  const dna = useQuery({ queryKey: queryKeys.dna, queryFn: meApi.dna })

  const top = queue.items[0]
  const isFocused = useIsFocused()
  const appActive = useAppActive()
  const screenReader = useScreenReaderEnabled()
  const audio = usePreviewAudio(top, { active: isFocused && appActive, autoplay: !screenReader })

  const goToEvents = useCallback(() => router.push('/events'), [])
  const swipe = useCallback((direction: SwipeDirection) => deck.current?.swipe(direction), [])
  const pass = useCallback(() => swipe('dislike'), [swipe])
  const like = useCallback(() => swipe('like'), [swipe])

  let body
  if (queue.error) {
    body = (
      <ErrorState
        title="No pudimos traer canciones"
        message={userMessage(queue.error)}
        onRetry={queue.reload}
        retrying={queue.isFetching}
      />
    )
  } else if (top) {
    body = (
      <>
        <SwipeDeck
          ref={deck}
          songs={queue.items}
          onDecide={queue.decide}
          isPlaying={audio.isPlaying}
          progress={audio.progress}
          onTogglePreview={audio.toggle}
        />
        <DiscoverActions
          hasPreview={audio.available}
          isPlaying={audio.isPlaying}
          onPass={pass}
          onLike={like}
          onTogglePreview={audio.toggle}
        />
      </>
    )
  } else if (queue.exhausted && !queue.isFetching) {
    body = (
      <EmptyState
        icon={VinylRecordIcon}
        title="Ya calificaste todo el catálogo por ahora"
        body="Vuelve pronto o mira los conciertos."
        action={{ label: 'Ver conciertos', onPress: goToEvents }}
        secondaryAction={{ label: 'Buscar canciones nuevas', onPress: queue.reload }}
      />
    )
  } else {
    body = <DeckSkeleton />
  }

  const radar = dna.data
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">
          Descubrir
        </Text>
        {unlockedNotice ? (
          <RadarUnlocked onSeeEvents={goToEvents} onDismiss={() => setUnlockedNotice(false)} />
        ) : radar && !radar.radarUnlocked ? (
          <RadarProgress swipeCount={radar.swipeCount} threshold={radar.radarThreshold} />
        ) : null}
      </View>
      <View style={styles.body}>{body}</View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: space.gutter, paddingTop: space.lg, paddingBottom: space.lg, gap: space.md },
    body: { flex: 1, paddingHorizontal: space.gutter },
  })
