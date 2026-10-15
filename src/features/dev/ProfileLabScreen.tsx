import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  CountBadge,
  ProfileTicket,
  PublicProfileBody,
  applyReaction,
  reactionFor,
  reactionLabel,
  reactionTone,
  type ProfileTarget,
} from '@/features/social'
import { ReactionSheet } from '@/features/social/components/ReactionSheet'
import type { PublicProfile, ReactionType } from '@/lib/api/types'
import { ReactionTag, Screen, SegmentedTabs, space } from '@/ui'

const PROFILE: PublicProfile = {
  id: 'demo',
  displayName: 'Valentina Rojas',
  age: 26,
  city: 'Medellín',
  bio: 'Voy a todo lo de Bomba Estéreo. Si hay salsa en vivo, me apunto.',
  genres: [
    { slug: 'salsa', name: 'Salsa' },
    { slug: 'rock-en-espanol', name: 'Rock en español' },
    { slug: 'indie', name: 'Indie' },
    { slug: 'vallenato', name: 'Vallenato' },
  ],
  artists: [
    { key: 'bomba-estereo', name: 'Bomba Estéreo', imageUrl: null, shared: true },
    { key: 'aterciopelados', name: 'Aterciopelados', imageUrl: null, shared: false },
    { key: 'diamante-electrico', name: 'Diamante Eléctrico', imageUrl: null, shared: true },
    { key: 'monsieur-perine', name: 'Monsieur Periné', imageUrl: null, shared: false },
  ],
  stats: { swipeCount: 128, genresExplored: 9, eventsMarked: 3 },
  common: { affinity: 80, sharedGenres: ['salsa'], sharedArtists: ['bomba-estereo'] },
  myReactions: [{ targetKind: 'genre', targetKey: 'salsa', reaction: 'meToo' }],
}

const COUNTS: Record<string, number> = { 'genre|salsa': 4, 'artist|bomba-estereo': 12, 'genre|indie': 1 }

// Solo en desarrollo: la boleta, los stickers, las reacciones y "Así te ven" con datos de prueba, sin API.
export function ProfileLabScreen() {
  const [mode, setMode] = useState<'visitor' | 'owner'>('visitor')
  const [profile, setProfile] = useState(PROFILE)
  const [picking, setPicking] = useState<ProfileTarget | null>(null)
  const [justPlaced, setJustPlaced] = useState<string | null>(null)
  const owner = mode === 'owner'

  const tag = (t: Pick<ProfileTarget, 'targetKind' | 'targetKey'>, style: object) => {
    const key = `${t.targetKind}|${t.targetKey}`
    if (owner) return <CountBadge count={COUNTS[key] ?? 0} />
    const mine = reactionFor(profile, t)
    return mine ? (
      <ReactionTag key={`${key}:${mine}`} label={reactionLabel(mine)} tone={reactionTone(mine)} justPlaced={justPlaced === key} style={style} />
    ) : null
  }

  const describe = (t: Pick<ProfileTarget, 'targetKind' | 'targetKey'>) => {
    if (owner) {
      const n = COUNTS[`${t.targetKind}|${t.targetKey}`] ?? 0
      return n ? `${n} ${n === 1 ? 'reacción' : 'reacciones'}` : null
    }
    const mine = reactionFor(profile, t)
    return mine ? `tu sticker: ${reactionLabel(mine)}` : null
  }

  const pick = (reaction: ReactionType | null) => {
    if (!picking) return
    setJustPlaced(reaction ? `${picking.targetKind}|${picking.targetKey}` : null)
    setProfile((p) => applyReaction(p, { targetKind: picking.targetKind, targetKey: picking.targetKey, reaction }))
    setPicking(null)
  }

  return (
    <Screen mode="scroll" edges={[]}>
      <View style={styles.page}>
        <SegmentedTabs
          segments={[
            { value: 'visitor', label: 'Perfil ajeno' },
            { value: 'owner', label: 'Así te ven' },
          ]}
          value={mode}
          onChange={setMode}
          accessibilityLabel="Modo"
        />
        <ProfileTicket
          name={profile.displayName}
          meta={`${profile.age} años · ${profile.city}`}
          bio={profile.bio}
          genres={profile.genres.map((g) => ({ key: g.slug, name: g.name }))}
          onGenrePress={owner ? undefined : (g) => setPicking({ targetKind: 'genre', targetKey: g.key, name: g.name })}
          renderGenreExtra={(g) => tag({ targetKind: 'genre', targetKey: g.key }, styles.genreTag)}
          describeGenre={(g) => describe({ targetKind: 'genre', targetKey: g.key })}
        />
        <PublicProfileBody
          profile={profile}
          showGenres={false}
          showShared={!owner}
          titles={{ genres: 'Sus géneros', artists: 'Lo que suena', season: 'Su temporada' }}
          onTargetPress={owner ? undefined : setPicking}
          renderExtra={(t) => (t.targetKind === 'artist' ? tag(t, styles.artistTag) : null)}
          describe={describe}
        />
      </View>
      <ReactionSheet
        target={picking}
        current={picking ? reactionFor(profile, picking) : null}
        personName={profile.displayName}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { gap: space.xxl, paddingBottom: space.xxxl },
  genreTag: { top: -space.lg - space.xs, right: -space.lg },
  artistTag: { top: -space.sm, right: -space.xs },
})
