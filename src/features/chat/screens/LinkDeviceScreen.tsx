import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Linking, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated'
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile'
import { DeviceMobileCameraIcon } from 'phosphor-react-native/src/icons/DeviceMobileCamera'
import { isApiError, userMessage } from '@/lib/api/errors'
import { linkApi } from '@/lib/api/endpoints'
import { useUser } from '@/lib/session/SessionContext'
import {
  Button,
  EmptyState,
  ErrorState,
  haptics,
  Icon,
  ListRow,
  ListSection,
  LoadingState,
  LockKeyIcon,
  motion,
  QrCodeIcon,
  radius,
  Screen,
  ShieldCheckIcon,
  space,
  Text,
  type as typeScale,
  useStyles,
  useTheme,
  WarningIcon,
  type Theme,
} from '@/ui'
import { resetChatCaches } from '../backup/useChatBackup'
import { Callout } from '../components/KeyCareBits'
import { isE2eeError } from '../crypto'
import { useChatDeps } from '../data/ChatDepsContext'
import {
  acceptLink,
  checkLinkRequest,
  discardLink,
  NotALinkQrError,
  openLinkRequest,
  prepareLinkTransfer,
  type LinkTransport,
  type PendingLink,
  type PreparedTransfer,
} from '../link/linkDevice'
import { QrSvg } from '../qr/QrSvg'

const transport: LinkTransport = linkApi
const POLL_MS = 2500
const QR_SIZE = 232
const FRAME = 232
const CORNER = 28

type Mode = 'choose' | 'new' | 'old'

const fade = FadeIn.duration(motion.duration.base).easing(Easing.bezier(...motion.easeOut)).reduceMotion(ReduceMotion.System)

// "123 456": dos grupos de tres se comparan de un vistazo y el lector de pantalla los dice dígito a dígito.
const groupCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`
const spokenCode = (code: string) => code.split('').join(' ')

function remaining(expiresAt: number, now: number): string {
  const s = Math.max(0, Math.round((expiresAt - now) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function LinkDeviceScreen() {
  const [mode, setMode] = useState<Mode>('choose')
  const title = mode === 'new' ? 'Teléfono nuevo' : mode === 'old' ? 'Enviar mis llaves' : 'Vincular otro teléfono'
  return (
    <>
      <Stack.Screen options={{ title }} />
      {mode === 'new' ? (
        <NewDevice onCancel={() => setMode('choose')} />
      ) : mode === 'old' ? (
        <OldDevice onCancel={() => setMode('choose')} />
      ) : (
        <Choose onPick={setMode} />
      )}
    </>
  )
}

function Choose({ onPick }: { onPick: (mode: Mode) => void }) {
  const styles = useStyles(makeStyles)
  return (
    <Screen mode="scroll" edges={['bottom']}>
      <View style={styles.page}>
        <Text variant="body">
          Pasa tus llaves del chat de un teléfono a otro. Es un traspaso: los dos quedan con la misma identidad y tus
          contactos siguen viendo el mismo código de seguridad.
        </Text>
        <ListSection title="¿Qué teléfono tienes en la mano?">
          <ListRow
            icon={DeviceMobileIcon}
            title="Este es el teléfono nuevo"
            subtitle="Muestra un código QR para escanear"
            onPress={() => onPick('new')}
          />
          <ListRow
            icon={DeviceMobileCameraIcon}
            title="Este es el que ya uso"
            subtitle="Escanea el QR del teléfono nuevo"
            onPress={() => onPick('old')}
          />
        </ListSection>
        <View style={styles.notes}>
          <Text variant="title2" accessibilityRole="header">
            Lo que debes saber
          </Text>
          <Text variant="callout" color="textMuted">
            Tus llaves viajan cifradas solo hacia el teléfono nuevo: el servidor no las puede abrir. El código QR vence
            en 10 minutos y sirve una sola vez.
          </Text>
          <Text variant="callout" color="textMuted">
            El historial no viaja por aquí. Para llevarlo, crea un respaldo cifrado en el teléfono que ya usas y
            restáuralo en el nuevo.
          </Text>
          <Text variant="callout" color="textMuted">
            Está pensado para cambiar de teléfono. Si sigues usando los dos, cada mensaje queda solo en el que lo
            descargue primero.
          </Text>
        </View>
      </View>
    </Screen>
  )
}

// --- Teléfono nuevo: QR, espera y confirmación del código ---

type NewStep = { kind: 'confirm' } | { kind: 'mismatch' } | { kind: 'done' }

function NewDevice({ onCancel }: { onCancel: () => void }) {
  const styles = useStyles(makeStyles)
  const theme = useTheme()
  const { id: me } = useUser()
  const deps = useChatDeps()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PendingLink | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [step, setStep] = useState<NewStep>({ kind: 'confirm' })
  const finished = useRef(false)
  // En desarrollo los efectos corren dos veces; sin esta marca se abrirían dos buzones (el back permite 3).
  const requested = useRef(false)

  const open = useMutation({ mutationFn: () => openLinkRequest(transport), onSuccess: setPending })
  const startOpen = open.mutate

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    startOpen()
  }, [startOpen])

  // Si se sale sin terminar, la efímera se borra de memoria y el buzón del servidor también.
  useEffect(
    () => () => {
      if (pending && !finished.current) discardLink(transport, pending).catch(() => undefined)
    },
    [pending],
  )

  const expired = pending !== null && now >= pending.expiresAt
  useEffect(() => {
    if (!pending || expired) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pending, expired])

  const poll = useQuery({
    queryKey: ['keys', 'link-requests', pending?.linkId],
    queryFn: () => checkLinkRequest(transport, pending!),
    enabled: !!pending && !expired && step.kind === 'confirm',
    refetchInterval: (q) => (q.state.data ? false : POLL_MS),
    // El material cifrado no se compara por estructura; tampoco se deja en caché al salir.
    structuralSharing: false,
    gcTime: 0,
  })
  const received = poll.data ?? null

  useEffect(() => {
    if (received) {
      haptics.light()
      AccessibilityInfo.announceForAccessibility(`Llegaron tus llaves. Compara el código ${spokenCode(received.code)}.`)
    }
  }, [received])

  const accept = useMutation({
    mutationFn: () => acceptLink({ deps, me, transport, pending: pending!, received: received! }),
    onMutate: () => {
      finished.current = true
    },
    onSuccess: () => {
      haptics.success()
      resetChatCaches(queryClient)
      setStep({ kind: 'done' })
    },
    onError: () => {
      finished.current = false
      haptics.warning()
    },
  })

  const reject = async () => {
    finished.current = true
    haptics.warning()
    setStep({ kind: 'mismatch' })
    if (pending) await discardLink(transport, pending).catch(() => undefined)
  }

  const restart = () => {
    finished.current = false
    setPending(null)
    setStep({ kind: 'confirm' })
    setNow(Date.now())
    startOpen()
  }

  if (open.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState
          title="No pudimos crear el código"
          message={
            isApiError(open.error, 'too_many_link_requests')
              ? 'Tienes varios códigos abiertos. Espera unos minutos y vuelve a intentarlo.'
              : userMessage(open.error)
          }
          onRetry={restart}
        />
      </Screen>
    )
  }
  if (!pending) {
    return (
      <Screen edges={[]}>
        <LoadingState label="Creando el código" />
      </Screen>
    )
  }

  if (step.kind === 'done') {
    return (
      <Screen
        edges={[]}
        footer={
          <>
            <Button label="Traer mi historial" onPress={() => router.replace('/chat-backup')} />
            <Button label="Listo" variant="secondary" onPress={() => router.back()} />
          </>
        }
      >
        <Animated.View entering={fade} style={styles.center}>
          <View style={styles.statusRow}>
            <Icon icon={ShieldCheckIcon} size={28} color="verified" weight="fill" />
            <Text variant="title2" color="verified" accessibilityRole="header">
              Llaves instaladas
            </Text>
          </View>
          <Text variant="body" color="textMuted" align="center">
            Este teléfono ya usa tus llaves del chat. Tus mensajes anteriores no viajaron: si tienes un respaldo,
            restáuralo para traerlos.
          </Text>
        </Animated.View>
      </Screen>
    )
  }

  if (step.kind === 'mismatch') {
    return (
      <Screen edges={[]}>
        <EmptyState
          icon={WarningIcon}
          title="No instalamos nada"
          body="Si los códigos no coinciden, alguien pudo meterse en medio. Empieza de nuevo con los dos teléfonos juntos."
          action={{ label: 'Generar otro código', onPress: restart }}
          secondaryAction={{ label: 'Salir', onPress: onCancel }}
        />
      </Screen>
    )
  }

  if (received) {
    return (
      <Screen
        mode="scroll"
        edges={[]}
        footer={
          <>
            <Button label="Coinciden, instalar mis llaves" loading={accept.isPending} onPress={() => accept.mutate()} />
            <Button label="No coinciden" variant="secondary" disabled={accept.isPending} onPress={() => void reject()} />
          </>
        }
      >
        <Animated.View entering={fade} style={styles.page}>
          <Text variant="body">Tu otro teléfono debe mostrar este mismo código. Compáralos antes de seguir.</Text>
          <View style={styles.codeBox} accessible accessibilityLabel={`Código de vinculación: ${spokenCode(received.code)}`}>
            <Text variant="data" style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
              {groupCode(received.code)}
            </Text>
          </View>
          {accept.isError ? (
            <Callout icon={WarningIcon} tone="danger">
              <Text variant="callout">
                {isE2eeError(accept.error)
                  ? 'Lo que llegó no se pudo abrir o no es de tu cuenta. No instalamos nada.'
                  : userMessage(accept.error)}
              </Text>
            </Callout>
          ) : null}
        </Animated.View>
      </Screen>
    )
  }

  if (expired) {
    return (
      <Screen edges={[]}>
        <EmptyState
          icon={QrCodeIcon}
          title="El código venció"
          body="Por seguridad, cada código dura 10 minutos."
          action={{ label: 'Generar otro código', onPress: restart }}
        />
      </Screen>
    )
  }

  return (
    <Screen mode="scroll" edges={['bottom']}>
      <View style={styles.page}>
        <Text variant="body">
          En el teléfono que ya usas, abre Tú › Vincular otro teléfono › Este es el que ya uso, y escanea este código.
        </Text>
        <View style={styles.qrCard}>
          <QrSvg
            value={pending.qr}
            size={QR_SIZE}
            color={theme.onTicket}
            background={theme.ticket}
            accessibilityLabel="Código QR para vincular este teléfono"
          />
        </View>
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <Text variant="callout" color="textMuted">
            Esperando al otro teléfono · vence en
          </Text>
          <Text variant="data" color="textMuted">
            {remaining(pending.expiresAt, now)}
          </Text>
        </View>
        {poll.isError ? (
          <Callout icon={WarningIcon} tone="danger">
            <Text variant="callout">{userMessage(poll.error)}</Text>
          </Callout>
        ) : null}
        <Button label="Cancelar" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  )
}

// --- Teléfono viejo: escanear, mostrar código y enviar ---

function scanErrorMessage(error: unknown): string {
  if (error instanceof NotALinkQrError) {
    return 'Este QR no es de vinculación. En el teléfono nuevo abre Vincular otro teléfono › Este es el teléfono nuevo.'
  }
  if (isApiError(error, 'link_not_found')) return 'Ese código venció o es de otra cuenta. Genera uno nuevo en el teléfono nuevo.'
  if (isApiError(error, 'link_already_fulfilled') || isE2eeError(error, 'invalid_input')) {
    return 'Ese código ya se usó. Genera uno nuevo en el teléfono nuevo.'
  }
  if (isE2eeError(error, 'identity_mismatch')) {
    return 'El código del servidor no coincide con el QR. Por seguridad no enviamos nada.'
  }
  if (isE2eeError(error, 'missing_keys')) return 'Este teléfono todavía no tiene llaves del chat que pasar.'
  return userMessage(error)
}

type OldStep =
  | { kind: 'scan' }
  | { kind: 'preparing' }
  | { kind: 'ready'; transfer: PreparedTransfer }
  | { kind: 'sent'; code: string }
  | { kind: 'error'; message: string }

function OldDevice({ onCancel }: { onCancel: () => void }) {
  const styles = useStyles(makeStyles)
  const { id: me } = useUser()
  const deps = useChatDeps()
  const [permission, requestPermission] = useCameraPermissions()
  const [step, setStep] = useState<OldStep>({ kind: 'scan' })
  // El escáner dispara varias veces por segundo: solo se procesa la primera lectura.
  const locked = useRef(false)

  const onScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (locked.current) return
      locked.current = true
      setStep({ kind: 'preparing' })
      try {
        const transfer = await prepareLinkTransfer({ deps, me, transport, qrText: data })
        haptics.light()
        AccessibilityInfo.announceForAccessibility(`Código de vinculación: ${spokenCode(transfer.code)}`)
        setStep({ kind: 'ready', transfer })
      } catch (error) {
        haptics.warning()
        setStep({ kind: 'error', message: scanErrorMessage(error) })
      }
    },
    [deps, me],
  )

  const send = useMutation({
    mutationFn: (transfer: PreparedTransfer) => transfer.send(),
    onSuccess: (_, transfer) => {
      haptics.success()
      setStep({ kind: 'sent', code: transfer.code })
    },
    onError: (error) => {
      haptics.warning()
      setStep({ kind: 'error', message: scanErrorMessage(error) })
    },
  })

  const retry = () => {
    locked.current = false
    setStep({ kind: 'scan' })
  }

  if (step.kind === 'ready' || step.kind === 'sent') {
    const sent = step.kind === 'sent'
    const code = sent ? step.code : step.transfer.code
    return (
      <Screen
        mode="scroll"
        edges={[]}
        footer={
          sent ? (
            <Button label="Listo" onPress={() => router.back()} />
          ) : (
            <>
              <Button label="Enviar mis llaves" loading={send.isPending} onPress={() => send.mutate(step.transfer)} />
              <Button label="Cancelar" variant="ghost" disabled={send.isPending} onPress={onCancel} />
            </>
          )
        }
      >
        <Animated.View entering={fade} style={styles.page}>
          <Text variant="body">
            {sent
              ? 'Enviado. En el teléfono nuevo confirma que aparece este mismo código; si no coincide, que no instale nada.'
              : 'Al enviar, el teléfono nuevo te mostrará un código. Debe ser este.'}
          </Text>
          <View style={styles.codeBox} accessible accessibilityLabel={`Código de vinculación: ${spokenCode(code)}`}>
            <Text variant="data" style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
              {groupCode(code)}
            </Text>
          </View>
          <Callout icon={LockKeyIcon}>
            <Text variant="callout" color="textMuted">
              Van cifradas tu identidad y tus llaves vigentes, solo para ese teléfono. Tu historial no viaja.
            </Text>
          </Callout>
        </Animated.View>
      </Screen>
    )
  }

  if (step.kind === 'error') {
    return (
      <Screen edges={[]}>
        <EmptyState
          icon={WarningIcon}
          title="No enviamos tus llaves"
          body={step.message}
          action={{ label: 'Escanear de nuevo', onPress: retry }}
          secondaryAction={{ label: 'Salir', onPress: onCancel }}
        />
      </Screen>
    )
  }

  if (!permission) {
    return (
      <Screen edges={[]}>
        <LoadingState label="Preparando la cámara" />
      </Screen>
    )
  }
  if (!permission.granted) {
    return (
      <Screen edges={[]}>
        <EmptyState
          icon={QrCodeIcon}
          title="Escanea el QR del teléfono nuevo"
          body="Usamos la cámara solo para leer ese código. No tomamos fotos ni guardamos nada."
          action={
            permission.canAskAgain
              ? { label: 'Permitir la cámara', onPress: () => void requestPermission() }
              : { label: 'Abrir ajustes', onPress: () => void Linking.openSettings() }
          }
          secondaryAction={{ label: 'Volver', onPress: onCancel }}
        />
      </Screen>
    )
  }

  return (
    <Screen mode="scroll" edges={['bottom']}>
      <View style={styles.page}>
        <Text variant="body">Apunta al QR que muestra el teléfono nuevo en Vincular otro teléfono.</Text>
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={step.kind === 'scan' ? onScanned : undefined}
            accessibilityLabel="Vista de la cámara"
          />
          <View style={[styles.corner, styles.tl]} pointerEvents="none" />
          <View style={[styles.corner, styles.tr]} pointerEvents="none" />
          <View style={[styles.corner, styles.bl]} pointerEvents="none" />
          <View style={[styles.corner, styles.br]} pointerEvents="none" />
        </View>
        <Text variant="callout" color="textMuted" accessibilityLiveRegion="polite">
          {step.kind === 'preparing' ? 'Comprobando el código…' : 'Antes de enviar verás un código de 6 dígitos para comparar.'}
        </Text>
        <Button label="Cancelar" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    page: { gap: space.xl },
    notes: { gap: space.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm },
    qrCard: {
      alignSelf: 'center',
      padding: space.lg,
      borderRadius: radius.md,
      backgroundColor: t.ticket,
    },
    codeBox: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingVertical: space.xl,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    // El código es un dato que se compara entre dos pantallas: grande, en mono y con aire entre grupos.
    code: {
      fontSize: typeScale.display.fontSize,
      lineHeight: typeScale.display.fontSize + space.sm,
      letterSpacing: space.xs,
      color: t.text,
    },
    camera: {
      alignSelf: 'center',
      width: FRAME,
      height: FRAME,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: t.surface,
    },
    corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: t.ticket },
    tl: { top: space.sm, left: space.sm, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.sm },
    tr: { top: space.sm, right: space.sm, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.sm },
    bl: { bottom: space.sm, left: space.sm, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.sm },
    br: { bottom: space.sm, right: space.sm, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.sm },
  })
