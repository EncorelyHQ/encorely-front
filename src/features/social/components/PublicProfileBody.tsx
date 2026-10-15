import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { PublicProfile, ReactionTargetKind } from '@/lib/api/types'
import { ScrollReveal, Sticker, StickerTitle, Text, space, useStyles, type Theme } from '@/ui'
import { stickerAngleFor, stickerToneFor } from '../stickers'
import { ArtistCarousel } from './ArtistCarousel'
import { SeasonStats } from './SeasonStats'

export type ProfileTarget = { targetKind: ReactionTargetKind; targetKey: string; name: string }

type PublicProfileBodyProps = {
  profile: PublicProfile
  titles: { genres: string; artists: string; season: string }
  renderExtra?: (target: ProfileTarget) => ReactNode
  onTargetPress?: (target: ProfileTarget) => void
  targetHint?: string
  showShared?: boolean
  // Lo que va entre los géneros y los artistas (por ejemplo, "En común").
  middle?: ReactNode
}

// Lo que cualquiera ve de un perfil: géneros como stickers, artistas en carrusel y la temporada.
export function PublicProfileBody({ profile, titles, renderExtra, onTargetPress, targetHint, showShared = false, middle }: PublicProfileBodyProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.body}>
      {profile.genres.length ? (
        <ScrollReveal style={styles.section}>
          <StickerTitle label={titles.genres} angle={-2} />
          <View style={styles.stickers}>
            {profile.genres.map((g) => {
              const target: ProfileTarget = { targetKind: 'genre', targetKey: g.slug, name: g.name }
              const shared = showShared && profile.common.sharedGenres.includes(g.slug)
              const content = (
                <>
                  <Sticker label={g.name} tone={stickerToneFor(g.slug)} angle={stickerAngleFor(g.slug)} />
                  {renderExtra?.(target)}
                </>
              )
              const label = shared ? `${g.name}, en común` : g.name
              return onTargetPress ? (
                <Pressable
                  key={g.slug}
                  style={styles.stickerWrap}
                  onPress={() => onTargetPress(target)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint={targetHint}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={g.slug} style={styles.stickerWrap} accessible accessibilityLabel={label}>
                  {content}
                </View>
              )
            })}
          </View>
        </ScrollReveal>
      ) : null}

      {middle}

      {profile.artists.length ? (
        <ScrollReveal style={styles.section}>
          <StickerTitle label={titles.artists} tone="stamp" angle={2} />
          <View style={styles.bleed}>
            <ArtistCarousel
              artists={profile.artists}
              showShared={showShared}
              pressHint={targetHint}
              onPress={onTargetPress ? (a) => onTargetPress({ targetKind: 'artist', targetKey: a.key, name: a.name }) : undefined}
              renderExtra={renderExtra ? (a) => renderExtra({ targetKind: 'artist', targetKey: a.key, name: a.name }) : undefined}
            />
          </View>
        </ScrollReveal>
      ) : null}

      <ScrollReveal style={styles.section}>
        <Text variant="title2" accessibilityRole="header">
          {titles.season}
        </Text>
        <SeasonStats stats={profile.stats} />
      </ScrollReveal>
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    body: { gap: space.xxl },
    section: { gap: space.lg },
    stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingTop: space.sm },
    stickerWrap: { position: 'relative' },
    // El carrusel trae su propio margen lateral: sale del padding del Screen para llegar al borde.
    bleed: { marginHorizontal: -space.gutter },
  })
