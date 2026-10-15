import { useMemo, useState } from 'react'
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import * as Application from 'expo-application'
import { useMutation } from '@tanstack/react-query'
import { meApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import type { Dna, Me } from '@/lib/api/types'
import { useSession, useUser } from '@/lib/session/SessionContext'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  EyeIcon,
  HeartIcon,
  ListRow,
  ListSection,
  LockKeyIcon,
  ProhibitIcon,
  Screen,
  ScrollReveal,
  SegmentedTabs,
  SignOutIcon,
  Skeleton,
  space,
  StickerTitle,
  Text,
  TrashIcon,
  UserIcon,
  useStyles,
  useTheme,
  useToast,
  VinylRecordIcon,
  type Theme,
} from '@/ui'
import { DownloadSimpleIcon } from 'phosphor-react-native/src/icons/DownloadSimple'
import { LegalRow, SessionsRow } from '@/features/account'
import { AdminEntryRow } from '@/features/admin'
import { genreName, useGenreLookup } from '@/features/events'
import {
  ArtistCarousel,
  CountBadge,
  ProfileTicket,
  PublicProfileBody,
  SeasonStats,
  useProfile,
  VISIBILITY_COPY,
  visibilityOf,
} from '@/features/social'
import { ChatBackupRow, LinkDeviceRow } from '@/features/chat'
import { SpotifyConnectCard } from '@/features/spotify'
import { GenreBars } from '../components/GenreBars'
import { SpotifyLinkRow } from '../components/SpotifyLinkRow'
import { computeGenreBars } from '../genreBars'
import { useDnaQuery, useMeQuery } from '../queries'

type Tab = 'mine' | 'seen'
const TABS = [
  { value: 'mine', label: 'Tu perfil' },
  { value: 'seen', label: 'Así te ven' },
] as const

// Conteo de reacciones por objetivo (sumando los tres tipos), para pegarlo sobre cada sticker en "Así te ven".
function reactionCounts(me: Me | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of me?.reactionsReceived ?? []) {
    const key = `${r.targetKind}|${r.targetKey}`
    counts.set(key, (counts.get(key) ?? 0) + r.count)
  }
  return counts
}

// Tab "Tú": la boleta con tus gustos como stickers, "Tu perfil | Así te ven", y debajo los ajustes en lista nativa.
export function MeScreen() {
  const styles = useStyles(makeStyles)
  const theme = useTheme()
  const toast = useToast()
  const user = useUser()
  const { signOut } = useSession()
  const isAdmin = user.role === 'admin'
  const me = useMeQuery()
  const dna = useDnaQuery()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [tab, setTab] = useState<Tab>('mine')
  const { genres: catalog } = useGenreLookup()
  const [signingOut, setSigningOut] = useState(false)

  const exportData = useMutation({
    mutationFn: meApi.export,
    onSuccess: async (data) => {
      try {
        await Share.share({ title: 'Mis datos de Encorely', message: JSON.stringify(data, null, 2) })
      } catch (error) {
        toast.show(userMessage(error), 'danger')
      }
    },
    onError: (error) => toast.show(userMessage(error), 'danger'),
  })

  const name = me.data?.displayName ?? user.displayName
  const meta = [me.data?.age != null ? `${me.data.age} años` : null, me.data?.city].filter(Boolean).join(' · ')
  const version = Application.nativeApplicationVersion

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      setSigningOut(false)
      toast.show(userMessage(error), 'danger')
    }
  }

  return (
    <Screen
      mode="scroll"
      refreshing={(me.isRefetching || dna.isRefetching) && !me.isPending}
      onRefresh={() => {
        void me.refetch()
        void dna.refetch()
      }}
    >
      <View style={styles.page}>
        <ProfileTicket
          name={name}
          meta={meta || null}
          bio={me.data?.bio}
          genres={(me.data?.genres ?? []).map((slug) => ({ key: slug, name: genreName(slug, catalog) }))}
        />

        <SegmentedTabs segments={TABS} value={tab} onChange={setTab} accessibilityLabel="Cómo ver tu perfil" />

        {tab === 'mine' ? (
          <>
            <ScrollReveal style={styles.music}>
              <MusicSummary
                data={dna.data}
                pending={dna.isPending}
                error={dna.isError ? dna.error : null}
                retrying={dna.isRefetching}
                onRetry={() => void dna.refetch()}
              />
            </ScrollReveal>

            <ScrollReveal style={styles.section}>
              <StickerTitle label="Tus artistas" tone="stamp" angle={2} />
              {me.data?.artists.length ? (
                <View style={styles.bleed}>
                  <ArtistCarousel artists={me.data.artists} />
                </View>
              ) : null}
              <SpotifyConnectCard />
            </ScrollReveal>

            {me.data ? (
              <ScrollReveal style={styles.section}>
                <Text variant="title2" accessibilityRole="header">
                  Tu temporada
                </Text>
                <SeasonStats stats={me.data.stats} />
              </ScrollReveal>
            ) : null}
          </>
        ) : me.data ? (
          <SeenByOthers me={me.data} />
        ) : (
          <Skeleton height={space.xxxl * 3} />
        )}

        <ListSection title="Cuenta">
          <ListRow title="Editar perfil" icon={UserIcon} onPress={() => router.push('/profile/edit')} />
          <SpotifyLinkRow me={me.data} />
          <ListRow
            title="Descargar mis datos"
            subtitle="Una copia de tu información. Sin mensajes: no los podemos leer."
            icon={DownloadSimpleIcon}
            chevron={!exportData.isPending}
            trailing={exportData.isPending ? <ActivityIndicator color={theme.textMuted} /> : undefined}
            onPress={() => {
              if (!exportData.isPending) exportData.mutate()
            }}
          />
        </ListSection>

        <ListSection title="Privacidad y seguridad">
          <ListRow
            title="Privacidad del perfil"
            subtitle={me.data ? (me.data.profileVisible ? 'Otras personas te ven' : 'Nadie más te ve') : undefined}
            icon={EyeIcon}
            onPress={() => router.push('/settings/profile-visibility')}
          />
          <ListRow title="Reacciones que recibiste" icon={HeartIcon} onPress={() => router.push('/reactions')} />
          <ListRow title="Personas bloqueadas" icon={ProhibitIcon} onPress={() => router.push('/settings/blocked')} />
          <ListRow
            title="Cómo protegemos tus chats"
            icon={LockKeyIcon}
            onPress={() => router.push('/settings/privacy')}
          />
          <ChatBackupRow />
          <LinkDeviceRow />
          <SessionsRow />
          <LegalRow />
        </ListSection>

        {isAdmin ? (
          <ListSection title="Administración">
            <AdminEntryRow />
          </ListSection>
        ) : null}

        <ListSection title="Sesión">
          <ListRow title="Cerrar sesión" icon={SignOutIcon} chevron={false} onPress={() => setConfirmSignOut(true)} />
          <ListRow
            title="Borrar cuenta"
            icon={TrashIcon}
            destructive
            onPress={() => router.push('/settings/delete-account')}
          />
        </ListSection>

        {version ? (
          <Text variant="caption" color="textSubtle" align="center">
            Encorely <Text variant="data" color="textSubtle">{version}</Text>
          </Text>
        ) : null}
      </View>

      <ConfirmSheet
        visible={confirmSignOut}
        title="¿Cerrar sesión?"
        message="Puedes volver a entrar con tu correo cuando quieras."
        confirmLabel="Cerrar sesión"
        loading={signingOut}
        onConfirm={() => void handleSignOut()}
        onCancel={() => {
          if (!signingOut) setConfirmSignOut(false)
        }}
      />
    </Screen>
  )
}

// "Así te ven": tu perfil público tal como lo pide cualquiera (GET /users/{tuId}/profile), con los conteos encima.
function SeenByOthers({ me }: { me: Me }) {
  const styles = useStyles(makeStyles)
  const profile = useProfile(me.id)
  const visibility = visibilityOf(me)
  const counts = reactionCounts(me)
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)

  return (
    <View style={styles.seen}>
      <View style={styles.notice} accessible accessibilityLiveRegion="polite">
        <Text variant="callout" color="textMuted">
          {visibility === 'visible' ? 'Así te ve cualquier persona en Encorely. Los números son las reacciones que recibiste: solo tú los ves.' : VISIBILITY_COPY[visibility]}
        </Text>
        <View style={styles.noticeActions}>
          {visibility !== 'visible' ? (
            <Button label="Privacidad del perfil" variant="secondary" fullWidth={false} onPress={() => router.push('/settings/profile-visibility')} />
          ) : null}
          {total > 0 ? (
            <Button
              label={`Ver quién reaccionó (${total})`}
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push('/reactions')}
            />
          ) : null}
        </View>
      </View>

      {profile.isPending ? (
        <View style={styles.skeletons} accessible accessibilityRole="progressbar" accessibilityLabel="Cargando cómo te ven">
          <Skeleton width="40%" height={space.xl} />
          <Skeleton height={space.xxxl} />
          <Skeleton height={space.xxxl * 2} />
        </View>
      ) : profile.isError ? (
        <ErrorState
          title="No pudimos cargar tu perfil público"
          message={userMessage(profile.error)}
          onRetry={() => void profile.refetch()}
          retrying={profile.isRefetching}
        />
      ) : (
        <PublicProfileBody
          profile={profile.data}
          titles={{ genres: 'Tus géneros', artists: 'Tus artistas', season: 'Tu temporada' }}
          renderExtra={(t) => <CountBadge count={counts.get(`${t.targetKind}|${t.targetKey}`) ?? 0} />}
          describe={(t) => {
            const n = counts.get(`${t.targetKind}|${t.targetKey}`) ?? 0
            return n ? `${n} ${n === 1 ? 'reacción' : 'reacciones'}` : null
          }}
        />
      )}
    </View>
  )
}

function MusicSummary({
  data,
  pending,
  error,
  retrying,
  onRetry,
}: {
  data: Dna | undefined
  pending: boolean
  error: unknown
  retrying: boolean
  onRetry: () => void
}) {
  const styles = useStyles(makeStyles)
  const bars = useMemo(() => (data ? computeGenreBars(data.genres) : []), [data])
  const heading = <StickerTitle label="Tu música" angle={-2} />

  if (pending) {
    return (
      <View style={styles.musicBody}>
        {heading}
        <View style={styles.skeletons} accessible accessibilityLabel="Cargando tu música">
          {[0.9, 0.7, 0.5].map((w) => (
            <View key={w} style={styles.skeletonRow}>
              <Skeleton width={`${w * 50}%`} height={space.md} />
              <Skeleton width={`${w * 100}%`} height={space.sm} />
            </View>
          ))}
        </View>
      </View>
    )
  }

  if (error || !data) {
    return (
      <ErrorState title="No pudimos cargar tu música" message={userMessage(error)} onRetry={onRetry} retrying={retrying} />
    )
  }

  // Sin datos, el título del estado vacío hace de encabezado: dos títulos seguidos competirían.
  if (bars.length === 0) {
    return (
      <EmptyState
        icon={VinylRecordIcon}
        title="Aún no sabemos qué escuchas"
        body={
          data.swipeCount === 0
            ? 'Califica algunas canciones y aquí verás los géneros que más te gustan.'
            : 'Todavía no hay géneros que te gusten. Califica más canciones para verlos aquí.'
        }
        action={{ label: 'Calificar canciones', onPress: () => router.push('/') }}
      />
    )
  }

  return (
    <View style={styles.musicBody}>
      {heading}
      <GenreBars bars={bars} />
      <Text variant="footnote" color="textMuted">
        Has calificado{' '}
        <Text variant="data" color="text">
          {data.swipeCount}
        </Text>{' '}
        {data.swipeCount === 1 ? 'canción' : 'canciones'}. Los porcentajes suman 100 y salen de tus calificaciones, los
        géneros de tu perfil y Spotify si lo conectaste.
      </Text>
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xxl, paddingBottom: space.xl },
    music: { gap: space.lg },
    section: { gap: space.lg },
    bleed: { marginHorizontal: -space.gutter },
    seen: { gap: space.xl },
    notice: { gap: space.md },
    noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    musicBody: { gap: space.lg },
    skeletons: { gap: space.lg },
    skeletonRow: { gap: space.sm },
  })
