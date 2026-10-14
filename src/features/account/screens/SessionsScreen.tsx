import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { userMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/session/SessionContext'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  ListSection,
  Screen,
  Skeleton,
  space,
  Text,
  useStyles,
  useToast,
  type Theme,
} from '@/ui'
import { DevicesIcon } from 'phosphor-react-native/src/icons/Devices'
import { SessionItem } from '../components/SessionItem'
import { useRevokeAllSessions, useRevokeOtherSessions, useRevokeSession, useSessionsQuery } from '../queries'
import { otherSessionIds, toSessionRows, type SessionRow } from '../sessions'

type Pending = { kind: 'one'; row: SessionRow } | { kind: 'others'; ids: string[] } | { kind: 'all' } | null

export function SessionsScreen() {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { signOut } = useSession()
  const sessions = useSessionsQuery()
  const revokeOne = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const revokeAll = useRevokeAllSessions()
  const [pending, setPending] = useState<Pending>(null)
  const [signingOut, setSigningOut] = useState(false)

  const data = sessions.data
  // "hace N min" se mide contra el momento de la respuesta: se actualiza al refrescar, no en cada render.
  const rows = useMemo(
    () => (data ? toSessionRows(data.sessions, data.currentId, { now: sessions.dataUpdatedAt }) : []),
    [data, sessions.dataUpdatedAt],
  )
  const currentKnown = !!data?.currentId
  const others = data ? otherSessionIds(data.sessions, data.currentId) : []
  const busy = revokeOne.isPending || revokeOthers.isPending || revokeAll.isPending || signingOut

  async function confirm() {
    if (!pending) return
    if (pending.kind === 'one') {
      revokeOne.mutate(pending.row.id, {
        onSuccess: () => toast.show('Cerramos esa sesión.', 'success'),
        onError: (error) => toast.show(userMessage(error), 'danger'),
        onSettled: () => setPending(null),
      })
      return
    }
    if (pending.kind === 'others') {
      revokeOthers.mutate(pending.ids, {
        onSuccess: (count) =>
          toast.show(count === 1 ? 'Cerramos la otra sesión.' : `Cerramos ${count} sesiones.`, 'success'),
        onError: (error) => toast.show(userMessage(error), 'danger'),
        onSettled: () => setPending(null),
      })
      return
    }
    // El access token sigue vivo unos minutos tras revocar los refresh: alcanza para que signOut limpie push y chat.
    try {
      await revokeAll.mutateAsync()
      setSigningOut(true)
      await signOut()
    } catch (error) {
      setSigningOut(false)
      setPending(null)
      toast.show(userMessage(error), 'danger')
    }
  }

  const footer = !data ? null : currentKnown ? (
    others.length > 0 ? (
      <Button
        label="Cerrar sesión en todos los demás"
        size="lg"
        disabled={busy}
        onPress={() => setPending({ kind: 'others', ids: others })}
      />
    ) : null
  ) : rows.length > 0 ? (
    <Button label="Cerrar todas las sesiones" variant="destructive" size="lg" disabled={busy} onPress={() => setPending({ kind: 'all' })} />
  ) : null

  return (
    <Screen
      mode="scroll"
      edges={footer ? [] : ['bottom']}
      footer={footer}
      refreshing={sessions.isRefetching && !sessions.isPending}
      onRefresh={() => void sessions.refetch()}
    >
      <Stack.Screen options={{ title: 'Sesiones abiertas' }} />
      <View style={styles.page}>
        <Text variant="body" color="textMuted">
          Cada sesión es un teléfono donde entraste con tu cuenta. Si no reconoces una, ciérrala.
        </Text>

        {sessions.isPending ? (
          <View style={styles.skeletons} accessible accessibilityLabel="Cargando sesiones" accessibilityRole="progressbar">
            {[0, 1].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width="45%" height={space.lg} />
                <Skeleton width="70%" height={space.md} />
              </View>
            ))}
          </View>
        ) : sessions.isError ? (
          <ErrorState
            title="No pudimos ver tus sesiones"
            message={userMessage(sessions.error)}
            onRetry={() => void sessions.refetch()}
            retrying={sessions.isRefetching}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={DevicesIcon}
            title="No hay sesiones abiertas"
            body="Si acabas de cerrar otras, desliza hacia abajo para actualizar."
            action={{ label: 'Actualizar', onPress: () => void sessions.refetch() }}
          />
        ) : (
          <ListSection
            footer={
              currentKnown
                ? 'Encorely no guarda el modelo de tu teléfono, por eso las demás sesiones no dicen cuál es.'
                : 'No logramos reconocer cuál de estas es este teléfono. Puedes cerrar una por una o todas a la vez; si cierras todas, tendrás que volver a entrar aquí también.'
            }
          >
            {rows.map((row) => (
              <SessionItem
                key={row.id}
                row={row}
                closing={revokeOne.isPending && pending?.kind === 'one' && pending.row.id === row.id}
                disabled={busy}
                onClose={row.isCurrent ? undefined : () => setPending({ kind: 'one', row })}
              />
            ))}
          </ListSection>
        )}
      </View>

      <ConfirmSheet
        visible={pending !== null}
        title={
          pending?.kind === 'all'
            ? '¿Cerrar todas las sesiones?'
            : pending?.kind === 'others'
              ? '¿Cerrar las demás sesiones?'
              : '¿Cerrar esta sesión?'
        }
        message={
          pending?.kind === 'all'
            ? 'Se cierra en todos tus dispositivos, incluido este. Vas a tener que entrar otra vez con tu correo.'
            : pending?.kind === 'others'
              ? 'Este teléfono sigue con tu sesión abierta. En los demás tendrás que volver a entrar.'
              : 'Ese dispositivo deja de tener acceso a tu cuenta. Puede volver a entrar con tu correo y contraseña.'
        }
        confirmLabel={pending?.kind === 'all' ? 'Cerrar todas' : 'Cerrar sesión'}
        destructive
        loading={busy}
        onConfirm={() => void confirm()}
        onCancel={() => {
          if (!busy) setPending(null)
        }}
      />
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xl, paddingBottom: space.xl },
    skeletons: { gap: space.lg },
    skeletonRow: { gap: space.sm },
  })
