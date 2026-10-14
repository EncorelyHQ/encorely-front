import { useCallback, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated'
import { isApiError, userMessage } from '@/lib/api/errors'
import { useUser } from '@/lib/session/SessionContext'
import {
  Button,
  ConfirmSheet,
  ErrorState,
  haptics,
  ListRow,
  ListSection,
  LoadingState,
  LockKeyIcon,
  motion,
  Screen,
  space,
  Text,
  TrashIcon,
  useStyles,
  useToast,
  WarningIcon,
} from '@/ui'
import { BackupTooLargeError, createBackup, restoreBackup } from '../backup/backup'
import { passphraseStrength } from '../backup/passphrase'
import {
  backupQueryKeys,
  backupTransport,
  resetChatCaches,
  useBackupInfo,
  useHistoryEstimate,
} from '../backup/useChatBackup'
import { Callout, PassphraseField, ProgressLine, StrengthMeter } from '../components/KeyCareBits'
import { isE2eeError } from '../crypto'
import { useChatDeps } from '../data/ChatDepsContext'
import { formatBytes, formatDate } from '../data/format'

type Mode = 'overview' | 'create' | 'restore'

const fade = FadeIn.duration(motion.duration.base).easing(Easing.bezier(...motion.easeOut)).reduceMotion(ReduceMotion.System)

const FORGET_WARNING = 'Si olvidas la frase, nadie puede recuperar tus mensajes, ni nosotros.'

// onProgress de scrypt llega cientos de veces: solo se repinta cada 2 %.
function useThrottledProgress() {
  const [progress, setProgress] = useState(0)
  const last = useRef(0)
  const report = useCallback((value: number) => {
    if (value === 0 || value === 1 || value - last.current >= 0.02) {
      last.current = value
      setProgress(value)
    }
  }, [])
  const reset = useCallback(() => {
    last.current = 0
    setProgress(0)
  }, [])
  return { progress, report, reset }
}

export function ChatBackupScreen() {
  const [mode, setMode] = useState<Mode>('overview')
  const header = (
    <Stack.Screen
      options={{ title: mode === 'create' ? 'Crear respaldo' : mode === 'restore' ? 'Restaurar' : 'Respaldo cifrado' }}
    />
  )
  if (mode === 'create') {
    return (
      <>
        {header}
        <CreateBackup onDone={() => setMode('overview')} />
      </>
    )
  }
  if (mode === 'restore') {
    return (
      <>
        {header}
        <RestoreBackup onDone={() => setMode('overview')} />
      </>
    )
  }
  return (
    <>
      {header}
      <Overview onCreate={() => setMode('create')} onRestore={() => setMode('restore')} />
    </>
  )
}

function Overview({ onCreate, onRestore }: { onCreate: () => void; onRestore: () => void }) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const queryClient = useQueryClient()
  const info = useBackupInfo()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const remove = useMutation({
    mutationFn: () => backupTransport.remove(),
    onSuccess: () => {
      setConfirmDelete(false)
      queryClient.setQueryData(backupQueryKeys.info, null)
      toast.show('Borramos tu respaldo del servidor.')
    },
    onError: (error) => {
      setConfirmDelete(false)
      toast.show(userMessage(error), 'danger')
    },
  })

  if (info.isPending) {
    return (
      <Screen edges={[]}>
        <LoadingState label="Buscando tu respaldo" />
      </Screen>
    )
  }
  if (info.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState title="No pudimos ver tu respaldo" message={userMessage(info.error)} onRetry={() => void info.refetch()} />
      </Screen>
    )
  }

  const backup = info.data
  const footer = (
    <>
      <Button label={backup ? 'Actualizar respaldo' : 'Crear respaldo'} onPress={onCreate} />
      {backup ? <Button label="Restaurar en este teléfono" variant="secondary" onPress={onRestore} /> : null}
    </>
  )

  return (
    <Screen mode="scroll" edges={[]} footer={footer}>
      <View style={styles.page}>
        <Text variant="body">
          Guarda en el servidor una copia de tus llaves del chat y, si quieres, de tu historial. Se cifra en este
          teléfono con una frase que solo tú sabes: el servidor guarda algo que no puede abrir.
        </Text>

        <Callout icon={WarningIcon} tone="accent">
          <Text variant="headline">{FORGET_WARNING}</Text>
        </Callout>

        <ListSection title="Tu respaldo">
          {backup ? (
            <>
              <ListRow
                icon={LockKeyIcon}
                title="Último respaldo"
                subtitle={`${formatDate(Date.parse(backup.updatedAt))} · ${formatBytes(backup.sizeBytes)}`}
              />
              <ListRow icon={TrashIcon} title="Borrar respaldo" destructive onPress={() => setConfirmDelete(true)} />
            </>
          ) : (
            <ListRow icon={LockKeyIcon} title="Aún no tienes respaldo" subtitle="Sin él, cambiar de teléfono borra tus chats." />
          )}
        </ListSection>

        <View style={styles.notes}>
          <Text variant="title2" accessibilityRole="header">
            Antes de crearlo
          </Text>
          <Text variant="callout" color="textMuted">
            El respaldo guarda las llaves de este momento. Mientras exista, quien tenga tu frase puede leer los mensajes
            de esa época, aunque este teléfono ya haya borrado esas llaves. Bórralo cuando ya no lo necesites.
          </Text>
          <Text variant="callout" color="textMuted">
            Para pasar tus llaves a otro teléfono sin escribir la frase, usa Vincular otro teléfono. El historial solo
            viaja por el respaldo.
          </Text>
        </View>
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        title="¿Borrar el respaldo?"
        message="Si pierdes este teléfono después, no habrá forma de recuperar tus chats."
        confirmLabel="Borrar respaldo"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  )
}

function CreateBackup({ onDone }: { onDone: () => void }) {
  const styles = useStyles(makeStyles)
  const { id: me } = useUser()
  const deps = useChatDeps()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [phrase, setPhrase] = useState('')
  const [repeat, setRepeat] = useState('')
  const [includeHistory, setIncludeHistory] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { progress, report, reset } = useThrottledProgress()
  const estimate = useHistoryEstimate(me, true)

  const strength = passphraseStrength(phrase)
  const mismatch = repeat.length > 0 && repeat !== phrase
  const historyFits = estimate.data?.fits ?? false
  const ready = strength.ok && repeat === phrase

  const create = useMutation({
    mutationFn: () => {
      reset()
      setError(null)
      return createBackup({
        deps,
        me,
        passphrase: phrase,
        includeHistory: includeHistory && historyFits,
        transport: backupTransport,
        onProgress: report,
      })
    },
    onSuccess: (info) => {
      haptics.success()
      queryClient.setQueryData(backupQueryKeys.info, info)
      toast.show('Respaldo guardado. Guarda tu frase en un lugar seguro.', 'success')
      onDone()
    },
    onError: (err) => {
      haptics.warning()
      const message =
        err instanceof BackupTooLargeError || isApiError(err, 'payload_too_large')
          ? 'Tu historial supera los 10 MB del respaldo. Créalo sin historial.'
          : userMessage(err)
      setError(message)
      AccessibilityInfo.announceForAccessibility(message)
    },
  })

  const historyRow = estimate.data ? (
    <ListRow
      title="Incluir el historial"
      subtitle={
        historyFits
          ? `Unos ${formatBytes(estimate.data.approxBytes)} · ${estimate.data.messages} ${estimate.data.messages === 1 ? 'mensaje guardado' : 'mensajes guardados'} en este teléfono`
          : `Pesa unos ${formatBytes(estimate.data.approxBytes)}, más que el máximo de 10 MB. Solo se respaldan las llaves.`
      }
      switchValue={includeHistory && historyFits}
      onSwitchChange={historyFits ? setIncludeHistory : undefined}
    />
  ) : null

  const footer = (
    <>
      {create.isPending ? (
        <ProgressLine progress={progress} label="Cifrando en tu teléfono" />
      ) : null}
      <Button
        label="Cifrar y guardar"
        disabled={!ready || create.isPending}
        loading={create.isPending}
        onPress={() => setConfirming(true)}
      />
      <Button label="Cancelar" variant="ghost" disabled={create.isPending} onPress={onDone} />
    </>
  )

  return (
    <Screen mode="form" edges={[]} footer={footer}>
      <View style={styles.page}>
        <Text variant="body">
          Elige una frase larga que no uses en otro lado, por ejemplo cuatro palabras que no tengan relación entre sí.
        </Text>
        <View style={styles.fields}>
          <PassphraseField
            label="Frase del respaldo"
            value={phrase}
            onChangeText={setPhrase}
            editable={!create.isPending}
            returnKeyType="next"
          />
          <StrengthMeter strength={strength} />
          <PassphraseField
            label="Repite la frase"
            value={repeat}
            onChangeText={setRepeat}
            editable={!create.isPending}
            error={mismatch ? 'No es igual a la frase de arriba.' : null}
          />
        </View>
        {historyRow ? <ListSection footer="Sin historial, al restaurar tendrás tus llaves pero no los mensajes ya guardados.">{historyRow}</ListSection> : null}
        {error ? (
          <Animated.View entering={fade} accessibilityLiveRegion="assertive">
            <Callout icon={WarningIcon} tone="danger">
              <Text variant="callout">{error}</Text>
            </Callout>
          </Animated.View>
        ) : null}
      </View>

      <ConfirmSheet
        visible={confirming}
        title="¿Ya guardaste la frase?"
        message={`${FORGET_WARNING} Cifrar puede tardar hasta un minuto: deja la app abierta.`}
        confirmLabel="Sí, la guardé"
        onConfirm={() => {
          setConfirming(false)
          create.mutate()
        }}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  )
}

function RestoreBackup({ onDone }: { onDone: () => void }) {
  const styles = useStyles(makeStyles)
  const { id: me } = useUser()
  const deps = useChatDeps()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [phrase, setPhrase] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { progress, report, reset } = useThrottledProgress()

  const restore = useMutation({
    mutationFn: () => {
      reset()
      setFieldError(null)
      setError(null)
      return restoreBackup({ deps, me, passphrase: phrase, transport: backupTransport, onProgress: report })
    },
    onSuccess: ({ messages }) => {
      haptics.success()
      resetChatCaches(queryClient)
      toast.show(
        messages > 0 ? `Restauramos tus llaves y ${messages} mensajes.` : 'Restauramos tus llaves.',
        'success',
      )
      onDone()
    },
    onError: (err) => {
      haptics.warning()
      if (isE2eeError(err, 'aead_failed')) {
        setFieldError('La frase no abre este respaldo. Revísala y vuelve a intentarlo.')
        AccessibilityInfo.announceForAccessibility('La frase no abre este respaldo.')
        return
      }
      const message = isE2eeError(err)
        ? 'Este respaldo no se puede usar en esta cuenta o está dañado. No cambiamos nada.'
        : userMessage(err)
      setError(message)
      AccessibilityInfo.announceForAccessibility(message)
    },
  })

  const footer = (
    <>
      {restore.isPending ? <ProgressLine progress={progress} label="Descifrando en tu teléfono" /> : null}
      <Button
        label="Restaurar"
        disabled={phrase.trim().length === 0 || restore.isPending}
        loading={restore.isPending}
        onPress={() => setConfirming(true)}
      />
      <Button label="Cancelar" variant="ghost" disabled={restore.isPending} onPress={onDone} />
    </>
  )

  return (
    <Screen mode="form" edges={[]} footer={footer}>
      <View style={styles.page}>
        <Text variant="body">
          Escribe la frase con la que creaste el respaldo. Tus llaves y tu historial se instalan en este teléfono y tus
          contactos siguen viendo el mismo código de seguridad.
        </Text>
        <PassphraseField
          label="Frase del respaldo"
          value={phrase}
          onChangeText={(text) => {
            setPhrase(text)
            setFieldError(null)
          }}
          editable={!restore.isPending}
          error={fieldError}
        />
        {error ? (
          <Animated.View entering={fade} accessibilityLiveRegion="assertive">
            <Callout icon={WarningIcon} tone="danger">
              <Text variant="callout">{error}</Text>
            </Callout>
          </Animated.View>
        ) : null}
      </View>

      <ConfirmSheet
        visible={confirming}
        title="¿Restaurar el respaldo?"
        message="Si este teléfono tiene otras llaves de chat, se reemplazan por las del respaldo. Los mensajes que te llegaron cifrados a esas llaves no se podrán leer."
        confirmLabel="Restaurar"
        onConfirm={() => {
          setConfirming(false)
          restore.mutate()
        }}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  )
}

const makeStyles = () =>
  StyleSheet.create({
    page: { gap: space.xl },
    fields: { gap: space.md },
    notes: { gap: space.md },
  })
