import { useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { E2EE_LIMITS, E2EE_SUMMARY } from '@/features/safety'
import { userMessage } from '@/lib/api/errors'
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  haptics,
  Icon,
  LoadingState,
  LockKeyIcon,
  QrCodeIcon,
  radius,
  Screen,
  space,
  Text,
  useStyles,
  useToast,
  WarningIcon,
  type Theme,
} from '@/ui'
import { isE2eeError } from '../crypto'
import { SafetyCodeTicket } from '../components/SafetyCodeTicket'
import { usePeerSecurity } from '../hooks/usePeerSecurity'

type Props = { matchId: string }
type Confirm = 'none' | 'verify' | 'accept'

export function SecurityScreen({ matchId }: Props) {
  const security = usePeerSecurity(matchId)
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const [confirm, setConfirm] = useState<Confirm>('none')
  const [busy, setBusy] = useState(false)
  const [justVerified, setJustVerified] = useState(false)
  const name = security.match?.peer.displayName ?? ''

  const run = async (action: () => Promise<void>, onSuccess: () => void) => {
    setBusy(true)
    try {
      await action()
      setConfirm('none')
      onSuccess()
    } catch (error) {
      setConfirm('none')
      // markVerified exige la misma llave que se mostró: si cambió mientras se comparaba, se avisa y se recarga.
      toast.show(
        isE2eeError(error)
          ? 'El código cambió mientras lo comparaban. Revísenlo de nuevo.'
          : userMessage(error),
        'danger',
      )
      security.retry()
    } finally {
      setBusy(false)
    }
  }

  const header = <Stack.Screen options={{ title: 'Código de seguridad' }} />

  if (security.peerProblem === 'closed') {
    return (
      <Screen edges={[]}>
        {header}
        <EmptyState title="Esta conversación terminó." action={{ label: 'Volver', onPress: () => router.back() }} />
      </Screen>
    )
  }
  if (security.peerProblem === 'noKeys') {
    return (
      <Screen edges={[]}>
        {header}
        <EmptyState
          icon={LockKeyIcon}
          title="Todavía no hay código"
          body={`${name} tiene que abrir la app una vez para activar el cifrado. Cuando lo haga, aquí verás el código de los dos.`}
        />
      </Screen>
    )
  }
  if (security.peerProblem === 'invalid' || (security.error && !security.code)) {
    return (
      <Screen edges={[]}>
        {header}
        <ErrorState
          title="No pudimos calcular el código"
          message={
            security.peerProblem === 'invalid'
              ? `Las llaves de cifrado de ${name} no pasaron la comprobación. Por seguridad no las usamos.`
              : userMessage(security.error)
          }
          onRetry={security.retry}
        />
      </Screen>
    )
  }
  if (!security.code) {
    return (
      <Screen edges={[]}>
        {header}
        <LoadingState label="Calculando el código de seguridad" />
      </Screen>
    )
  }

  const verified = security.trust === 'verified'
  const changed = security.trust === 'changed'

  const footer = verified ? null : (
    <>
      <Button
        label="Escanear su código"
        icon={QrCodeIcon}
        onPress={() => router.push({ pathname: '/chat/[matchId]/scan', params: { matchId } })}
      />
      <Button label="Marcar como verificado" variant="secondary" onPress={() => setConfirm('verify')} />
      {changed ? (
        <Button label="Aceptar el código nuevo sin verificar" variant="ghost" onPress={() => setConfirm('accept')} />
      ) : null}
    </>
  )

  return (
    <Screen mode="scroll" edges={verified ? ['bottom'] : []} footer={footer}>
      {header}
      <View style={styles.content}>
        {changed ? (
          <View style={styles.alert} accessibilityRole="alert">
            <Icon icon={WarningIcon} size={20} color="danger" weight="fill" />
            <Text variant="callout" style={styles.flex}>
              El código de {name} cambió. Puede que haya reinstalado la app. Compárenlo de nuevo antes de compartir algo
              sensible.
            </Text>
          </View>
        ) : null}

        <SafetyCodeTicket
          peerName={name}
          blocks={security.code.blocks}
          qrPayload={security.qrPayload}
          verified={verified}
          stampAnimated={justVerified}
        />

        <Text variant="body" color={verified ? 'textMuted' : 'text'}>
          {verified
            ? `Verificaste este código con ${name}. Si cambia, el chat te avisa.`
            : 'Cuando se vean en el concierto, comparen este código o escaneen el QR del otro. Si coincide, nadie más está leyendo.'}
        </Text>

        <View style={styles.section}>
          <Text variant="title2" accessibilityRole="header">
            Lo que debes saber
          </Text>
          <Text variant="callout" color="textMuted">
            {E2EE_SUMMARY}
          </Text>
          <View style={styles.limits}>
            {E2EE_LIMITS.map((limit) => (
              <View key={limit.id} style={styles.limit} accessible accessibilityLabel={limit.text}>
                <Text variant="headline">{limit.lead}</Text>
                <Text variant="callout" color="textMuted">
                  {limit.detail.charAt(0).toUpperCase() + limit.detail.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ConfirmSheet
        visible={confirm === 'verify'}
        title="¿Los códigos coinciden?"
        message={`Márcalo como verificado solo si comparaste los 60 dígitos con los del teléfono de ${name} y son iguales.`}
        confirmLabel="Sí, coinciden"
        loading={busy}
        onConfirm={() =>
          void run(security.markVerified, () => {
            haptics.success()
            setJustVerified(true)
            AccessibilityInfo.announceForAccessibility(`Verificaste el código con ${name}`)
          })
        }
        onCancel={() => setConfirm('none')}
      />
      <ConfirmSheet
        visible={confirm === 'accept'}
        title="¿Seguir sin verificar?"
        message={`Vas a usar el código nuevo de ${name} sin compararlo. Hazlo solo si sabes que reinstaló la app o cambió de teléfono.`}
        confirmLabel="Aceptar código nuevo"
        loading={busy}
        onConfirm={() => void run(security.acceptChange, () => toast.show('Aceptaste el código nuevo.'))}
        onCancel={() => setConfirm('none')}
      />
    </Screen>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    content: { gap: space.xl },
    flex: { flex: 1 },
    alert: {
      flexDirection: 'row',
      gap: space.md,
      alignItems: 'flex-start',
      padding: space.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      // El rojo va solo en el icono: el bloque entero en rojo sería alarma, no información.
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    section: { gap: space.md, paddingTop: space.sm },
    limits: { gap: space.lg },
    limit: { gap: space.xs / 2 },
  })
