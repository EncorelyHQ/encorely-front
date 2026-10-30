import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { ProfileArtist } from '@/lib/api/types'
import { Carousel3D, ReactionTag, font, motion, radius, space, sticker } from '@/ui'

export const ARTIST_CARD_WIDTH = 150
const CARD_HEIGHT = 196
// Mismo velo que SongCard: la foto manda y el nombre se lee encima. La tarjeta es tinta en los dos temas.
const VEIL = ['rgba(18,17,16,0)', 'rgba(18,17,16,0.88)'] as const

type ArtistCarouselProps = {
  artists: readonly ProfileArtist[]
  renderExtra?: (artist: ProfileArtist) => ReactNode
  onPress?: (artist: ProfileArtist) => void
  pressHint?: string
  // "En común" solo tiene sentido en el perfil de otra persona.
  showShared?: boolean
  describe?: (artist: ProfileArtist) => string | null
}

export function ArtistCarousel({ artists, renderExtra, onPress, pressHint, showShared = false, describe }: ArtistCarouselProps) {
  return (
    <Carousel3D
      data={artists}
      keyExtractor={(artist) => artist.key}
      itemWidth={ARTIST_CARD_WIDTH}
      accessibilityLabel="Artistas"
      renderItem={(artist) => {
        const label = [artist.name, showShared && artist.shared ? 'en común' : null, describe?.(artist)].filter(Boolean).join(', ')
        const card = <ArtistCard artist={artist} showShared={showShared} extra={renderExtra?.(artist)} />
        return onPress ? (
          <Pressable onPress={() => onPress(artist)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={pressHint}>
            {card}
          </Pressable>
        ) : (
          <View accessible accessibilityLabel={label}>
            {card}
          </View>
        )
      }}
    />
  )
}

function ArtistCard({ artist, showShared, extra }: { artist: ProfileArtist; showShared: boolean; extra: ReactNode }) {
  // Los artistas de "Me gusta" no traen foto: tarjeta tipográfica en tinta.
  const photo = artist.imageUrl
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, !photo && styles.typeCard]}>
        {photo ? (
          <>
            <Image
              source={{ uri: photo }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={{ duration: motion.duration.fast, effect: 'cross-dissolve' }}
              accessible={false}
            />
            <LinearGradient colors={VEIL} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
          </>
        ) : null}
        {/* adjustsFontSizeToFit: un nombre largo se achica en vez de partirse a mitad de palabra. */}
        <RNText
          style={[styles.name, !photo && styles.typeName]}
          numberOfLines={photo ? 3 : 4}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          maxFontSizeMultiplier={1.3}
        >
          {artist.name}
        </RNText>
      </View>
      {showShared && artist.shared ? <ReactionTag label="En común" anchor="left" tone="stamp" angle={-6} style={styles.sharedTag} /> : null}
      {extra}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    width: ARTIST_CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: space.md,
    backgroundColor: sticker.ink.bg,
  },
  typeCard: { borderWidth: 3, borderColor: sticker.cut },
  name: { fontFamily: font.title, fontSize: 22, lineHeight: 24, color: sticker.ink.fg },
  // Sin foto el nombre es la tarjeta: cartel grande en vez de un recuadro vacío.
  typeName: { fontFamily: font.display, fontSize: 36, lineHeight: 34, textTransform: 'uppercase' },
  sharedTag: { top: -space.sm, left: -space.xs },
})
