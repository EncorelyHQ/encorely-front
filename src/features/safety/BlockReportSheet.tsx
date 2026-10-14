import { useEffect, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { safetyApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import type { ReportReason, ReportRequest } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import {
  Button,
  FlagIcon,
  Icon,
  ListRow,
  ListSection,
  ProhibitIcon,
  radius,
  Sheet,
  space,
  Text,
  TextField,
  touch,
  useStyles,
  useToast,
  WarningIcon,
  type Theme,
} from '@/ui'
import { Checkbox } from './components/Checkbox'
import { RadioGroup } from './components/RadioGroup'
import { evidenceLabel, REPORT_DETAIL_MAX, REPORT_EVIDENCE_MAX, REPORT_REASONS } from './reportReasons'

export type ReportEvidence = NonNullable<ReportRequest['evidence']>[number]
// El chat entrega los mensajes ya descifrados (con su franking key) solo cuando se abre el reporte.
export type EvidenceProvider = () => readonly ReportEvidence[] | Promise<readonly ReportEvidence[]>
export type BlockReportOutcome = 'blocked' | 'reported' | 'reportedAndBlocked'
export type BlockReportStep = 'menu' | 'block' | 'report'

export type BlockReportSheetProps = {
  visible: boolean
  userId: string
  displayName: string
  matchId?: string
  // Para abrir directo en "Bloquear" o "Reportar" desde un menú propio del chat.
  initialStep?: BlockReportStep
  evidence?: EvidenceProvider
  // La hoja no se oculta sola: el padre pone visible=false en onClose y en onDone.
  onClose: () => void
  onDone: (outcome: BlockReportOutcome) => void
}

type Step = BlockReportStep | 'reported'
type EvidenceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: readonly ReportEvidence[] }
  | { status: 'error' }

const BLOCK_CONSEQUENCES = 'No podrá escribirte ni verte en el radar. El match se cierra.'
export const REPORT_RECEIVED = 'Recibimos tu reporte. Lo revisamos en menos de 24 horas.'

export function BlockReportSheet({
  visible,
  userId,
  displayName,
  matchId,
  initialStep = 'menu',
  evidence,
  onClose,
  onDone,
}: BlockReportSheetProps) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const queryClient = useQueryClient()
  const { height } = useWindowDimensions()

  const [step, setStep] = useState<Step>(initialStep)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [attach, setAttach] = useState(false)
  const [evidenceState, setEvidenceState] = useState<EvidenceState>({ status: 'idle' })
  const evidenceRequested = useRef(false)

  // El padre suele pasar una función nueva en cada render: se guarda en un ref para no reiniciar la carga.
  const evidenceRef = useRef(evidence)
  useEffect(() => {
    evidenceRef.current = evidence
  }, [evidence])

  // Pide la evidencia una sola vez por apertura y solo si la persona llega al reporte.
  useEffect(() => {
    const provider = evidenceRef.current
    if (!visible || step !== 'report' || !provider || evidenceRequested.current) return
    evidenceRequested.current = true
    let cancelled = false
    let settled = false
    Promise.resolve()
      .then(() => {
        if (!cancelled) setEvidenceState({ status: 'loading' })
        return provider()
      })
      .then((items) => {
        settled = true
        if (!cancelled) setEvidenceState({ status: 'ready', items: items.slice(-REPORT_EVIDENCE_MAX) })
      })
      .catch((error: unknown) => {
        settled = true
        // Solo el tipo de error: el contenido podría traer texto descifrado.
        console.warn('No se pudo preparar la evidencia del reporte', error instanceof Error ? error.name : 'unknown')
        if (!cancelled) setEvidenceState({ status: 'error' })
      })
    return () => {
      cancelled = true
      // Si se salió del paso antes de terminar, se vuelve a pedir al regresar.
      if (!settled) evidenceRequested.current = false
    }
  }, [visible, step])

  const block = useMutation({
    mutationFn: () => safetyApi.block(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.matches })
      void queryClient.invalidateQueries({ queryKey: queryKeys.blocks })
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'events' && q.queryKey[2] === 'radar' })
      toast.show(`Bloqueaste a ${displayName}.`, 'success')
      finish(step === 'reported' ? 'reportedAndBlocked' : 'blocked')
    },
  })

  const report = useMutation({
    mutationFn: (body: ReportRequest) => safetyApi.report(body),
    onSuccess: () => {
      toast.show(REPORT_RECEIVED, 'success')
      setStep('reported')
    },
  })

  const busy = block.isPending || report.isPending
  const evidenceItems = evidenceState.status === 'ready' ? evidenceState.items : []

  function reset() {
    setStep(initialStep)
    setReason(null)
    setDetail('')
    setAttach(false)
    setEvidenceState({ status: 'idle' })
    evidenceRequested.current = false
    block.reset()
    report.reset()
  }

  function finish(outcome: BlockReportOutcome) {
    reset()
    onDone(outcome)
  }

  function close() {
    if (busy) return
    if (step === 'reported') {
      finish('reported')
      return
    }
    reset()
    onClose()
  }

  function back() {
    block.reset()
    report.reset()
    if (initialStep === 'menu') setStep('menu')
    else close()
  }

  function submitReport() {
    if (!reason) return
    const trimmed = detail.trim()
    report.mutate({
      userId,
      reason,
      detail: trimmed ? trimmed : undefined,
      matchId,
      evidence: attach && evidenceItems.length > 0 ? [...evidenceItems] : undefined,
    })
  }

  const title =
    step === 'menu'
      ? displayName
      : step === 'block'
        ? `¿Bloquear a ${displayName}?`
        : step === 'report'
          ? `Reportar a ${displayName}`
          : 'Reporte enviado'

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <KeyboardAwareScrollView
        style={{ maxHeight: height * 0.72 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={space.xl}
      >
        {step === 'menu' ? (
          <>
            <Text variant="body" color="textMuted">
              Bloquear corta el contacto de inmediato. Reportar le avisa al equipo de moderación para que lo revise.
            </Text>
            <ListSection>
              <ListRow
                title={`Bloquear a ${displayName}`}
                icon={ProhibitIcon}
                destructive
                onPress={() => setStep('block')}
              />
              <ListRow title={`Reportar a ${displayName}`} icon={FlagIcon} onPress={() => setStep('report')} />
            </ListSection>
            <Button label="Cancelar" variant="ghost" onPress={close} />
          </>
        ) : null}

        {step === 'block' ? (
          <>
            <Text variant="body" color="textMuted">
              {BLOCK_CONSEQUENCES}
            </Text>
            <Text variant="footnote" color="textSubtle">
              Puedes desbloquear después desde Tú, en Personas bloqueadas. El match no se recupera.
            </Text>
            <ErrorLine error={block.error} />
            <View style={styles.actions}>
              <Button
                label={`Bloquear a ${displayName}`}
                variant="destructive"
                loading={block.isPending}
                onPress={() => block.mutate()}
              />
              <Button label={initialStep === 'block' ? 'Cancelar' : 'Volver'} variant="ghost" disabled={busy} onPress={back} />
            </View>
          </>
        ) : null}

        {step === 'report' ? (
          <>
            <Text variant="headline" accessibilityRole="header">
              ¿Qué pasó?
            </Text>
            <RadioGroup
              label="Motivo del reporte"
              options={REPORT_REASONS}
              value={reason}
              onChange={setReason}
              disabled={report.isPending}
            />
            <TextField
              label="Cuéntanos más (opcional)"
              value={detail}
              onChangeText={setDetail}
              multiline
              maxLength={REPORT_DETAIL_MAX}
              editable={!report.isPending}
              textAlignVertical="top"
              style={styles.multiline}
            />
            {evidence ? (
              <EvidenceBlock
                state={evidenceState}
                displayName={displayName}
                attach={attach}
                onAttachChange={setAttach}
                disabled={report.isPending}
              />
            ) : null}
            <ErrorLine error={report.error} />
            <View style={styles.actions}>
              <Button
                label="Enviar reporte"
                loading={report.isPending}
                disabled={!reason}
                onPress={submitReport}
                accessibilityHint={reason ? undefined : 'Primero elige un motivo'}
              />
              <Button label={initialStep === 'report' ? 'Cancelar' : 'Volver'} variant="ghost" disabled={busy} onPress={back} />
            </View>
          </>
        ) : null}

        {step === 'reported' ? (
          <>
            <Text variant="body">{REPORT_RECEIVED}</Text>
            <Text variant="body" color="textMuted">
              ¿Quieres bloquear también a {displayName}? {BLOCK_CONSEQUENCES}
            </Text>
            <ErrorLine error={block.error} />
            <View style={styles.actions}>
              <Button
                label={`Bloquear a ${displayName}`}
                variant="destructive"
                loading={block.isPending}
                onPress={() => block.mutate()}
              />
              <Button label="Ahora no" variant="ghost" disabled={busy} onPress={() => finish('reported')} />
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </Sheet>
  )
}

function EvidenceBlock({
  state,
  displayName,
  attach,
  onAttachChange,
  disabled,
}: {
  state: EvidenceState
  displayName: string
  attach: boolean
  onAttachChange: (value: boolean) => void
  disabled: boolean
}) {
  const styles = useStyles(makeStyles)
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <Text variant="footnote" color="textSubtle" accessibilityLiveRegion="polite">
        Preparando los mensajes del chat…
      </Text>
    )
  }
  if (state.status === 'error') {
    return (
      <Text variant="footnote" color="textMuted">
        No pudimos preparar los mensajes del chat. Igual puedes enviar el reporte sin ellos.
      </Text>
    )
  }
  if (state.items.length === 0) return null
  return (
    <View style={styles.notice}>
      <View style={styles.noticeHead}>
        <Icon icon={WarningIcon} size={20} color="accentText" />
        <Text variant="callout" color="textMuted" style={styles.noticeText}>
          Tu chat con {displayName} está cifrado y nadie de Encorely puede leerlo. Si adjuntas mensajes, los podrá leer
          quien revise el reporte.
        </Text>
      </View>
      <Checkbox label={evidenceLabel(state.items.length)} checked={attach} onChange={onAttachChange} disabled={disabled} />
    </View>
  )
}

function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
      {userMessage(error)}
    </Text>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    content: { gap: space.md, paddingBottom: space.xs },
    actions: { gap: space.sm, marginTop: space.xs },
    multiline: { minHeight: touch.large * 2 },
    notice: {
      gap: space.xs,
      padding: space.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.border,
    },
    noticeHead: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
    noticeText: { flex: 1 },
  })
