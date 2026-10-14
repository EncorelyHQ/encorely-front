import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { SharedValue } from 'react-native-reanimated'
import type { Song } from '@/lib/api/types'
import { motion, radius, space, Text, useStyles, type Theme } from '@/ui'
import { onCover, withAlpha } from '../model/color'
import { PlayingBars, PreviewProgress } from './PreviewMeter'

type SongCardProps = {
  song: Song
  genre: string
  // Solo la tarjeta de arriba tiene audio; las de atrás reciben false/null y no se re-renderizan por él.
  isPlaying: boolean
  progress: SharedValue<number> | null
}

// Velo neutro del negro del venue: separa el texto de cualquier portada sin teñirla.
const VEIL = [withAlpha(onCover.bg, 0), withAlpha(onCover.bg, 0.55), withAlpha(onCover.bg, 0.94)] as const
const VEIL_STOPS = [0, 0.4, 1] as const

export const SongCard = memo(function SongCard({ song, genre, isPlaying, progress }: SongCardProps) {
  const styles = useStyles(makeStyles)
  const hasPreview = !!song.previewUrl

  return (
    <View style={styles.card} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Image
        source={{ uri: song.coverUrl }}
        recyclingKey={song.id}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={{ duration: motion.duration.fast, effect: 'cross-dissolve' }}
        accessibilityIgnoresInvertColors
      />
      <LinearGradient colors={VEIL} locations={VEIL_STOPS} style={styles.veil} pointerEvents="none" />
      <View style={styles.content}>
        <Text variant="caption" style={styles.genre} numberOfLines={1}>
          {genre}
        </Text>
        <Text variant="title1" style={styles.title} numberOfLines={2}>
          {song.title}
        </Text>
        <Text variant="headline" style={styles.artist} numberOfLines={1}>
          {song.artist}
        </Text>
        <View style={styles.previewRow}>
          {hasPreview && isPlaying ? <PlayingBars /> : null}
          <Text variant="caption" style={styles.attribution} numberOfLines={1}>
            {hasPreview ? 'Vista previa: Apple Music' : 'Sin vista previa'}
          </Text>
        </View>
        {hasPreview && progress ? <PreviewProgress progress={progress} /> : null}
      </View>
    </View>
  )
})

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: t.surface2,
      justifyContent: 'flex-end',
    },
    veil: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
    content: { padding: space.lg, paddingTop: space.xxl, gap: space.xs },
    genre: {
      alignSelf: 'flex-start',
      color: onCover.text,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      marginBottom: space.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: withAlpha(onCover.text, 0.4),
      overflow: 'hidden',
    },
    title: { color: onCover.text },
    artist: { color: onCover.textMuted },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, minHeight: 16 },
    attribution: { color: onCover.textMuted, flexShrink: 1 },
  })
