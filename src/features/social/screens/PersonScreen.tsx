import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
// Directo a genres y no al index de events: el radar de events ya importa de social y el index cerraría un ciclo.
import { genresSentence, joinSpanish, useGenreLookup } from '@/features/events/genres'
import type { MatchRouteParams } from '@/features/match'
import { BlockReportSheet } from '@/features/safety'
import { userMessage } from '@/lib/api/errors'
import type { PublicProfile, ReactionType } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useUser } from '@/lib/session/SessionContext'
import {
  Button,
  ChatCircleIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  EmptyState,
  ErrorState,
  HeartIcon,
  Icon,
  IconButton,
  ReactionTag,
  Screen,
  ScrollReveal,
  Sheet,
  Skeleton,
  Text,
  UserCircleIcon,
  radius,
  space,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { AFFINITY_EXPLAINER, affinityPercent } from '../affinity'
import { ProfileTicket, type TicketGenre } from '../components/ProfileTicket'
import { PublicProfileBody, type ProfileTarget } from '../components/PublicProfileBody'
import { ReactionSheet } from '../components/ReactionSheet'
import { isProfileGone, socialErrorMessage, PROFILE_UNAVAILABLE } from '../errors'
import { useActiveMatchWith, useLikeProfile, useProfile, useReaction } from '../queries'
import { reactionFor } from '../reactions'
import { reactionLabel, reactionTone } from '../stickers'

const targetKey = (t: Pick<ProfileTarget, 'targetKind' | 'targetKey'>) => `${t.targetKind}|${t.targetKey}`

// Perfil de otra persona: se entra desde el radar, el match, el chat o una reacción recibida.
export function PersonScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const styles = useStyles(makeStyles)
  const qc = useQueryClient()
  const toast = useToast()
  const me = useUser()
  const profile = useProfile(userId)
  const reaction = useReaction(userId ?? '', { onError: (error) => toast.show(socialErrorMessage(error), 'danger') })
  const like = useLikeProfile(userId ?? '')
  const matchId = useActiveMatchWith(userId)
  const [picking, setPicking] = useState<ProfileTarget | null>(null)
  // Solo la etiqueta recién puesta rebota: las que ya estaban aparecen quietas.
  const [justPlaced, setJustPlaced] = useState<string | null>(null)
  const [safety, setSafety] = useState(false)
  const [liked, setLiked] = useState(false)
  const own = userId === me.id
  // Si el perfil dejó de verse, no se sigue mostrando lo que quedó en caché, ni siquiera el nombre en el encabezado.
  const gone = profile.isError && isProfileGone(profile.error)
  const name = gone ? '' : (profile.data?.displayName ?? '')

  const header = (
    <Stack.Screen
      options={{
        title: name,
        headerRight:
          profile.data && !own && !gone
            ? () => <IconButton icon={DotsThreeVerticalIcon} label={`Bloquear o reportar a ${name}`} onPress={() => setSafety(true)} />
            : undefined,
      }}
    />
  )

  if (profile.isPending) {
    return (
      <Screen mode="scroll" edges={[]}>
        {header}
        <View style={styles.skeleton} accessible accessibilityRole="progressbar" accessibilityLabel="Cargando perfil">
          <Skeleton height={220} radius={radius.md} />
          <Skeleton width="40%" height={space.xl} />
          <Skeleton height={196} radius={radius.md} />
        </View>
      </Screen>
    )
  }

  if (profile.isError) {
    return (
      <Screen edges={[]}>
        {header}
        {isProfileGone(profile.error) ? (
          <EmptyState icon={UserCircleIcon} title={PROFILE_UNAVAILABLE} action={{ label: 'Volver', onPress: () => router.back() }} />
        ) : (
          <ErrorState
            title="No pudimos cargar el perfil"
            message={userMessage(profile.error)}
            onRetry={() => void profile.refetch()}
            retrying={profile.isRefetching}
          />
        )}
      </Screen>
    )
  }

  const p = profile.data
  const meta = [p.age != null ? `${p.age} años` : null, p.city].filter(Boolean).join(' · ')

  const pick = (value: ReactionType | null) => {
    if (!picking) return
    const target = picking
    setPicking(null)
    setJustPlaced(value ? targetKey(target) : null)
    reaction.mutate({ targetKind: target.targetKind, targetKey: target.targetKey, reaction: value })
  }

  const tagFor = (target: Pick<ProfileTarget, 'targetKind' | 'targetKey'>, style: object) => {
    const mine = reactionFor(p, target)
    if (!mine) return null
    const key = targetKey(target)
    return (
      <ReactionTag
        key={`${key}:${mine}`}
        label={reactionLabel(mine)}
        tone={reactionTone(mine)}
        justPlaced={justPlaced === key}
        style={style}
      />
    )
  }

  const onLike = () =>
    like.mutate(undefined, {
      onSuccess: (result) => {
        setLiked(true)
        if (result.matched) void qc.invalidateQueries({ queryKey: queryKeys.matches })
        if (result.matched && result.matchId) {
          const params: MatchRouteParams = {
            matchId: result.matchId,
            peerName: p.displayName,
            peerId: p.id,
            genres: p.common.sharedGenres.join(','),
          }
          router.push({ pathname: '/match/[matchId]', params })
        } else if (result.matched) {
          toast.show(`Hicieron match con ${p.displayName}. Lo encuentras en Chats.`, 'success')
        } else {
          toast.show('Le avisaremos si también le interesas.')
        }
      },
      onError: (error) => toast.show(userMessage(error), 'danger'),
    })

  const footer = own ? undefined : matchId ? (
    <Button
      label="Escribir"
      icon={ChatCircleIcon}
      accessibilityHint={`Ya hicieron match. Abre el chat con ${p.displayName}`}
      onPress={() => router.push(`/chat/${matchId}`)}
    />
  ) : liked ? (
    <View style={styles.liked} accessible accessibilityLabel={`Te interesa ${p.displayName}`}>
      <Icon icon={CheckIcon} size={20} color="textMuted" weight="bold" />
      <Text variant="callout" color="textMuted">
        Te interesa
      </Text>
    </View>
  ) : (
    <Button
      label="Me interesa"
      icon={HeartIcon}
      loading={like.isPending}
      accessibilityHint={`Si a ${p.displayName} también le interesas, harán match`}
      onPress={onLike}
    />
  )

  const reactHint = own ? undefined : 'Pégale un sticker'
  const describe = (t: Pick<ProfileTarget, 'targetKind' | 'targetKey'>) => {
    const mine = reactionFor(p, t)
    return mine ? `tu sticker: ${reactionLabel(mine)}` : null
  }

  return (
    <Screen mode="scroll" edges={[]} footer={footer} refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      {header}
      <View style={styles.page}>
        <ProfileTicket
          name={p.displayName}
          meta={meta || null}
          bio={p.bio}
          genres={p.genres.map((g): TicketGenre => ({ key: g.slug, name: g.name }))}
          genreHint={reactHint}
          onGenrePress={own ? undefined : (g) => setPicking({ targetKind: 'genre', targetKey: g.key, name: g.name })}
          renderGenreExtra={(g) => tagFor({ targetKind: 'genre', targetKey: g.key }, styles.genreTag)}
          describeGenre={(g) => describe({ targetKind: 'genre', targetKey: g.key })}
        />

        <PublicProfileBody
          profile={p}
          showGenres={false}
          showShared
          titles={{ genres: 'Sus géneros', artists: 'Lo que suena', season: 'Su temporada' }}
          targetHint={reactHint}
          onTargetPress={own ? undefined : setPicking}
          renderExtra={(t) => (t.targetKind === 'artist' ? tagFor(t, styles.artistTag) : null)}
          describe={describe}
          middle={own ? null : <InCommon profile={p} />}
        />
      </View>

      <ReactionSheet
        target={picking}
        current={picking ? reactionFor(p, picking) : null}
        personName={p.displayName}
        onPick={pick}
        onClose={() => setPicking(null)}
      />

      {safety ? (
        <BlockReportSheet
          visible
          userId={p.id}
          displayName={p.displayName}
          onClose={() => setSafety(false)}
          onDone={(outcome) => {
            setSafety(false)
            if (outcome === 'reported') return
            // Bloqueado: su perfil ya no se ve y sus reacciones desaparecen de las mías.
            void qc.invalidateQueries({ queryKey: queryKeys.receivedReactions })
            qc.removeQueries({ queryKey: queryKeys.profile(p.id) })
            router.back()
          }}
        />
      ) : null}
    </Screen>
  )
}

// "En común": el porcentaje solo si el back lo manda, y siempre la razón al lado.
function InCommon({ profile }: { profile: PublicProfile }) {
  const styles = useStyles(makeStyles)
  const { genres } = useGenreLookup()
  const [explaining, setExplaining] = useState(false)
  const { affinity, sharedGenres, sharedArtists } = profile.common
  const artistNames = profile.artists.filter((a) => sharedArtists.includes(a.key)).map((a) => a.name)
  const lines = [
    sharedGenres.length ? `A los dos les gusta ${genresSentence(sharedGenres, genres)}.` : null,
    artistNames.length ? `Los dos escuchan ${joinSpanish(artistNames.slice(0, 3))}.` : null,
  ].filter((line): line is string => !!line)
  if (affinity === null && lines.length === 0) return null

  return (
    <ScrollReveal style={styles.common}>
      <Text variant="title2" accessibilityRole="header">
        En común
      </Text>
      {affinity !== null ? (
        <View style={styles.percentRow} accessible accessibilityLabel={`${affinityPercent(affinity)} de gustos en común`}>
          <Text variant="data" style={styles.percent}>
            {affinityPercent(affinity)}
          </Text>
          <Text variant="callout" color="textMuted">
            de gustos en común
          </Text>
        </View>
      ) : null}
      {lines.map((line) => (
        <Text key={line} variant="body" color="textMuted">
          {line}
        </Text>
      ))}
      <View style={styles.how}>
        <Button label="¿Cómo lo calculamos?" variant="ghost" fullWidth={false} onPress={() => setExplaining(true)} />
      </View>
      <Sheet visible={explaining} onClose={() => setExplaining(false)} title="¿Cómo lo calculamos?">
        {AFFINITY_EXPLAINER.map((paragraph) => (
          <Text key={paragraph} variant="body" color="textMuted">
            {paragraph}
          </Text>
        ))}
        <Button label="Entendido" variant="secondary" onPress={() => setExplaining(false)} />
      </Sheet>
    </ScrollReveal>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xxl, paddingBottom: space.xl },
    skeleton: { gap: space.xl },
    // Sobresale arriba a la derecha sin tapar el nombre del género.
    genreTag: { top: -space.lg - space.xs, right: -space.lg },
    artistTag: { top: -space.sm, right: -space.xs },
    common: { gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: t.surface },
    percentRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
    percent: { fontSize: 30, lineHeight: 34 },
    how: { alignItems: 'flex-start', marginLeft: -space.xl },
    liked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: space.xxxl },
  })
