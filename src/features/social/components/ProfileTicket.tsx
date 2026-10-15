import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Avatar, ParallaxTicket, Sticker, Text, TicketCard, space, useStyles, type Theme } from '@/ui'
import { stickerAngleFor, stickerToneFor } from '../stickers'

export type TicketGenre = { key: string; name: string }

type ProfileTicketProps = {
  name: string
  meta?: string | null
  bio?: string | null
  genres: readonly TicketGenre[]
  // Lo que se pega encima de cada sticker: la reacción que dejé o el conteo que recibí.
  renderGenreExtra?: (genre: TicketGenre) => ReactNode
  onGenrePress?: (genre: TicketGenre) => void
  genreHint?: string
  // Lo que la etiqueta encima dice en pantalla ("tu sticker: Yo también", "4 reacciones"): TalkBack no la lee sola.
  describeGenre?: (genre: TicketGenre) => string | null
}

// La boleta de arriba del perfil: tus gustos son stickers pegados en ella. Se inclina al bajar (ParallaxTicket).
export function ProfileTicket({
  name,
  meta,
  bio,
  genres,
  renderGenreExtra,
  onGenrePress,
  genreHint,
  describeGenre,
}: ProfileTicketProps) {
  const styles = useStyles(makeStyles)
  return (
    <ParallaxTicket>
      <TicketCard>
        <View style={styles.head}>
          <Avatar name={name} size={56} tone="ink" />
          <View style={styles.identity}>
            <Text variant="display" style={styles.name} accessibilityRole="header" numberOfLines={2}>
              {name}
            </Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
        </View>
        {genres.length ? (
          <View style={styles.stickers}>
            {genres.map((genre) => {
              const label = [genre.name, describeGenre?.(genre)].filter(Boolean).join(', ')
              const sticker = <Sticker label={genre.name} tone={stickerToneFor(genre.key)} angle={stickerAngleFor(genre.key)} />
              return onGenrePress ? (
                <Pressable
                  key={genre.key}
                  style={styles.stickerWrap}
                  onPress={() => onGenrePress(genre)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint={genreHint}
                >
                  {sticker}
                  {renderGenreExtra?.(genre)}
                </Pressable>
              ) : (
                <View key={genre.key} style={styles.stickerWrap} accessible accessibilityLabel={label}>
                  {sticker}
                  {renderGenreExtra?.(genre)}
                </View>
              )
            })}
          </View>
        ) : null}
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      </TicketCard>
    </ParallaxTicket>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    identity: { flex: 1, gap: space.xs },
    name: { color: t.onTicket },
    meta: { color: t.onTicketMuted, fontSize: 15, lineHeight: 20 },
    // Aire para la inclinación y las etiquetas que sobresalen de cada sticker.
    stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, paddingTop: space.xl, paddingBottom: space.xs },
    stickerWrap: { position: 'relative' },
    bio: { color: t.onTicket, paddingTop: space.lg },
  })
