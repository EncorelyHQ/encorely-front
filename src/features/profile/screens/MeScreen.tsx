import { useMemo, useState } from 'react'
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import * as Application from 'expo-application'
import { useMutation } from '@tanstack/react-query'
import { meApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import type { Dna } from '@/lib/api/types'
import { useSession, useUser } from '@/lib/session/SessionContext'
import {
  Avatar,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  ListRow,
  ListSection,
  LockKeyIcon,
  ProhibitIcon,
  Screen,
  SignOutIcon,
  Skeleton,
  space,
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
import { SpotifyConnectCard } from '@/features/spotify'
import { GenreBars } from '../components/GenreBars'
import { computeGenreBars } from '../genreBars'
import { useDnaQuery, useMeQuery } from '../queries'

// Tab "Tú": el perfil como "mi pase" (quién soy y qué escucho) y debajo los ajustes en lista nativa.
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
        <View style={styles.pass}>
          <Avatar name={name} size={96} />
          <View style={styles.identity}>
            <Text variant="title1" accessibilityRole="header">
              {name}
            </Text>
            {meta ? (
              <Text variant="callout" color="textMuted">
                {meta}
              </Text>
            ) : me.isPending ? (
              <Skeleton width="40%" height={space.lg} />
            ) : null}
          </View>
        </View>

        <View style={styles.music}>
          <MusicSummary
            data={dna.data}
            pending={dna.isPending}
            error={dna.isError ? dna.error : null}
            retrying={dna.isRefetching}
            onRetry={() => void dna.refetch()}
          />
        </View>

        <SpotifyConnectCard />

        <ListSection title="Cuenta">
          <ListRow title="Editar perfil" icon={UserIcon} onPress={() => router.push('/profile/edit')} />
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
          <ListRow title="Personas bloqueadas" icon={ProhibitIcon} onPress={() => router.push('/settings/blocked')} />
          <ListRow
            title="Cómo protegemos tus chats"
            icon={LockKeyIcon}
            onPress={() => router.push('/settings/privacy')}
          />
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
  const heading = (
    <Text variant="title2" accessibilityRole="header">
      Tu música
    </Text>
  )

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
        {data.swipeCount === 1 ? 'canción' : 'canciones'}. Los porcentajes salen de tus calificaciones, los géneros
        de tu perfil y Spotify si lo conectaste.
      </Text>
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xxl, paddingBottom: space.xl },
    pass: { gap: space.lg, paddingTop: space.lg },
    identity: { gap: space.xs },
    music: { gap: space.lg },
    musicBody: { gap: space.lg },
    skeletons: { gap: space.lg },
    skeletonRow: { gap: space.sm },
  })
