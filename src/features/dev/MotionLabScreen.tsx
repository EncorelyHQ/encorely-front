import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  Button,
  Carousel3D,
  ParallaxTicket,
  ReactionTag,
  ScrollReveal,
  Screen,
  Sticker,
  StickerTitle,
  Text,
  TicketCard,
  radius,
  space,
  useMotion,
  useStyles,
  type Theme,
} from '@/ui'

const GENRES = [
  { label: 'Salsa', tone: 'paper', angle: -4 },
  { label: 'Rock en español', tone: 'stamp', angle: 3 },
  { label: 'Indie', tone: 'band', angle: -2 },
  { label: 'Vallenato', tone: 'ink', angle: 5 },
] as const

const ARTISTS = ['Bomba Estéreo', 'Aterciopelados', 'Diamante Eléctrico', 'Monsieur Periné', 'Systema Solar', 'Grupo Niche']

// Banco de pruebas del PR 2, solo en desarrollo: medir fps al hacer scroll, reduce motion, fuente al 200 % y TalkBack.
export function MotionLabScreen() {
  const styles = useStyles(makeStyles)
  const { reduced } = useMotion()
  const [tag, setTag] = useState(0)

  return (
    <Screen mode="scroll" edges={[]}>
      <View style={styles.page}>
        <Text variant="footnote" color="textMuted">
          Reduce motion: {reduced ? 'activo' : 'apagado'}
        </Text>

        <ParallaxTicket>
          <TicketCard>
            <Text variant="display" style={styles.onTicket}>
              Valentina
            </Text>
            <View style={styles.stickers}>
              {GENRES.map((g) => (
                <Sticker key={g.label} label={g.label} tone={g.tone} angle={g.angle} />
              ))}
            </View>
          </TicketCard>
        </ParallaxTicket>

        <ScrollReveal style={styles.section}>
          <StickerTitle label="Lo que suena" angle={-3} />
          <Carousel3D
            data={ARTISTS}
            keyExtractor={(name) => name}
            itemWidth={150}
            accessibilityLabel="Artistas"
            renderItem={(name) => (
              <View style={styles.card} accessible accessibilityLabel={name}>
                <Text variant="title1" style={styles.onCard}>
                  {name}
                </Text>
              </View>
            )}
          />
        </ScrollReveal>

        <ScrollReveal style={styles.section}>
          <StickerTitle label="Reacciones" tone="stamp" angle={2} />
          <View style={styles.tagHost}>
            <Sticker label="Bomba Estéreo" tone="paper" angle={-3} />
            {tag > 0 ? <ReactionTag key={tag} label="Yo también" justPlaced style={styles.tag} /> : null}
          </View>
          <Button label="Pegar sticker" variant="secondary" fullWidth={false} onPress={() => setTag((n) => n + 1)} />
        </ScrollReveal>

        {Array.from({ length: 4 }, (_, i) => (
          <ScrollReveal key={i} style={styles.section}>
            <StickerTitle label={`Sección ${i + 1}`} tone={i % 2 ? 'band' : 'ink'} angle={i % 2 ? 2 : -2} />
            <View style={styles.filler} />
          </ScrollReveal>
        ))}
      </View>
    </Screen>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xxl, paddingBottom: space.xxxl },
    onTicket: { color: t.onTicket },
    stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingTop: space.lg },
    section: { gap: space.lg },
    card: {
      height: 196,
      borderRadius: radius.md,
      backgroundColor: t.surface2,
      justifyContent: 'flex-end',
      padding: space.md,
    },
    onCard: { color: t.text },
    tag: { top: 0, right: 0 },
    tagHost: { alignSelf: 'flex-start', paddingTop: space.lg, paddingRight: space.xl },
    filler: { height: 220, borderRadius: radius.md, backgroundColor: t.surface },
  })
