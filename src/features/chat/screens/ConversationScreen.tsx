import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native'
import { router, Stack } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BlockReportSheet, type BlockReportOutcome } from '@/features/safety'
import { matchesApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import {
  Button,
  ConfirmSheet,
  DotsThreeVerticalIcon,
  ErrorState,
  FlagIcon,
  IconButton,
  ListRow,
  ListSection,
  motion,
  radius,
  ShieldCheckIcon,
  Sheet,
  Skeleton,
  space,
  Text,
  useStyles,
  useTheme,
  useToast,
  XIcon,
  type Theme,
} from '@/ui'
import { ChatHeaderTitle } from '../components/ChatHeaderTitle'
import { Composer } from '../components/Composer'
import { MessageBubble } from '../components/MessageBubble'
import { DaySeparator, KeyChangeRow, MatchIntroRow } from '../components/SystemRows'
import { introTitle } from '../data/matchCopy'
import { buildTimeline, type TimelineRow } from '../data/timeline'
import { useConversation, type Conversation } from '../hooks/useConversation'
import { useNow } from '../hooks/useNow'

type Props = { matchId: string }
type Overlay = 'none' | 'menu' | 'unmatch' | 'safety'

// iOS no presenta un Modal mientras otro se está cerrando: se espera a que termine la animación de la hoja.
const SHEET_HANDOFF_MS = motion.duration.slow + 40

export function ConversationScreen({ matchId }: Props) {
  const conversation = useConversation(matchId)
  const { match, peerState, status } = conversation
  const styles = useStyles(makeStyles)
  const headerHeight = useHeaderHeight()
  const toast = useToast()
  const queryClient = useQueryClient()
  const name = match?.peer.displayName ?? ''

  const [overlay, setOverlay] = useState<Overlay>('none')
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (handoff.current) clearTimeout(handoff.current)
  }, [])
  const switchOverlay = useCallback((next: Overlay) => {
    setOverlay('none')
    handoff.current = setTimeout(() => setOverlay(next), SHEET_HANDOFF_MS)
  }, [])

  const openSecurity = useCallback(
    () => router.push({ pathname: '/chat/[matchId]/security', params: { matchId } }),
    [matchId],
  )

  const leave = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.matches, exact: true })
    queryClient.removeQueries({ queryKey: queryKeys.messages(matchId), exact: true })
    if (router.canGoBack()) router.back()
    else router.replace('/chats')
  }, [matchId, queryClient])

  const unmatch = useMutation({
    mutationFn: () => matchesApi.unmatch(matchId),
    onSuccess: () => {
      setOverlay('none')
      toast.show(`Deshiciste el match con ${name}.`)
      leave()
    },
    onError: (error) => toast.show(userMessage(error), 'danger'),
  })

  const onSafetyDone = useCallback(
    (outcome: BlockReportOutcome) => {
      setOverlay('none')
      // Bloquear cierra el match: no tiene sentido quedarse en una conversación que ya no existe.
      if (outcome !== 'reported') leave()
    },
    [leave],
  )

  const trust = peerState.kind === 'ready' ? peerState.trust : null

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: name,
          headerTitle: () => (
            <ChatHeaderTitle name={name} trust={trust} onPress={status === 'closed' ? undefined : openSecurity} />
          ),
          headerRight: () => (
            <IconButton icon={DotsThreeVerticalIcon} label="Más opciones" onPress={() => setOverlay('menu')} />
          ),
        }}
      />

      {/* El KAV mide su posición relativa al stack, que empieza bajo el encabezado: sin este offset el relleno
          queda corto justo esa altura y el teclado tapa la caja de texto (Android 15, edge-to-edge). */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.root}>
        <ConversationBody conversation={conversation} name={name} onSecurity={openSecurity} onLeave={leave} />
      </KeyboardAvoidingView>

      <Sheet visible={overlay === 'menu'} onClose={() => setOverlay('none')} title={name || 'Opciones'}>
        <ListSection>
          <ListRow
            title="Ver código de seguridad"
            icon={ShieldCheckIcon}
            onPress={() => {
              setOverlay('none')
              openSecurity()
            }}
          />
          {match ? (
            <ListRow title="Bloquear o reportar" icon={FlagIcon} onPress={() => switchOverlay('safety')} />
          ) : null}
          {match && status !== 'closed' ? (
            <ListRow title="Deshacer match" icon={XIcon} destructive onPress={() => switchOverlay('unmatch')} />
          ) : null}
        </ListSection>
      </Sheet>

      <ConfirmSheet
        visible={overlay === 'unmatch'}
        title={`¿Deshacer el match con ${name}?`}
        message="La conversación se cierra para los dos y no podrán volver a escribirse."
        confirmLabel="Deshacer match"
        destructive
        loading={unmatch.isPending}
        onConfirm={() => unmatch.mutate()}
        onCancel={() => setOverlay('none')}
      />

      {match ? (
        <BlockReportSheet
          visible={overlay === 'safety'}
          userId={match.peer.id}
          displayName={name}
          matchId={matchId}
          evidence={conversation.evidence}
          onClose={() => setOverlay('none')}
          onDone={onSafetyDone}
        />
      ) : null}
    </View>
  )
}

type BodyProps = {
  conversation: Conversation
  name: string
  onSecurity: () => void
  onLeave: () => void
}

function ConversationBody({ conversation, name, onSecurity, onLeave }: BodyProps) {
  const styles = useStyles(makeStyles)
  const { match, messages, hasMore, status, peerState, keyChanged } = conversation

  const now = useNow()
  const blocked = peerState.kind === 'ready' && peerState.requiresConfirmation
  const rows = useMemo(() => {
    const timeline = buildTimeline(messages, {
      now,
      showIntro: !!match && !hasMore,
      showKeyChange: keyChanged,
    })
    // FlatList invertida: el índice 0 queda abajo, junto al composer.
    return timeline.reverse()
  }, [messages, now, match, hasMore, keyChanged])

  const renderItem: ListRenderItem<TimelineRow> = useCallback(
    ({ item }) => {
      switch (item.kind) {
        case 'message':
          return (
            <MessageBubble
              message={item.message}
              peerName={name}
              firstInGroup={item.firstInGroup}
              lastInGroup={item.lastInGroup}
              onRetry={conversation.retry}
            />
          )
        case 'day':
          return <DaySeparator label={item.label} />
        case 'matchIntro':
          return <MatchIntroRow title={introTitle(match ?? { eventName: null })} onSecurityPress={onSecurity} />
        case 'keyChange':
          return <KeyChangeRow name={name} blocked={blocked} onReview={onSecurity} />
      }
    },
    [blocked, conversation.retry, match, name, onSecurity],
  )

  if (status === 'loading') return <ConversationSkeleton />

  if (status === 'error' && messages.length === 0) {
    return (
      <ErrorState
        title="No pudimos abrir el chat"
        message={userMessage(conversation.error)}
        onRetry={() => void conversation.refresh()}
      />
    )
  }

  return (
    <>
      <FlatList
        inverted
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onEndReached={hasMore ? () => void conversation.loadOlder() : undefined}
        onEndReachedThreshold={0.4}
        // En la lista invertida el "footer" queda arriba: ahí se carga el historial anterior.
        ListFooterComponent={
          <OlderLoader
            loading={conversation.loadingOlder}
            error={conversation.olderError}
            onRetry={() => void conversation.loadOlder()}
          />
        }
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: space.xxxl }}
      />
      <BottomBar>
        {status === 'closed' ? (
          <Notice text="Esta conversación terminó.">
            <Button label="Volver a Chats" variant="secondary" onPress={onLeave} />
          </Notice>
        ) : peerState.kind === 'noKeys' ? (
          <Notice
            text={`Todavía no puedes escribirle: ${name} tiene que abrir la app una vez para activar el cifrado.`}
          >
            <Button label="Volver a intentar" variant="ghost" onPress={() => void conversation.refresh()} />
          </Notice>
        ) : peerState.kind === 'invalid' ? (
          <Notice
            text={`No pudimos comprobar las llaves de cifrado de ${name}. Por seguridad no puedes escribirle por ahora.`}
          >
            <Button label="Volver a intentar" variant="ghost" onPress={() => void conversation.refresh()} />
          </Notice>
        ) : blocked ? (
          <Notice text={`Revisa el código de seguridad de ${name} antes de seguir escribiendo.`}>
            <Button label="Revisar el código" onPress={onSecurity} />
          </Notice>
        ) : (
          <>
            {conversation.quotaFull ? (
              <Text variant="footnote" color="textMuted" accessibilityLiveRegion="polite">
                {name} todavía no recibe tus mensajes anteriores. Cuando abra el chat podrás enviar más.
              </Text>
            ) : null}
            <Composer onSend={conversation.send} disabled={peerState.kind !== 'ready' || !peerState.canSend} />
          </>
        )}
      </BottomBar>
    </>
  )
}

// Al abrir el teclado el safe area inferior ya lo cubre el propio teclado: se anima de inset → 0 junto con él.
function BottomBar({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles)
  const insets = useSafeAreaInsets()
  const { progress } = useReanimatedKeyboardAnimation()
  const pad = useAnimatedStyle(() => ({
    paddingBottom: space.sm + Math.max(insets.bottom, space.sm) * (1 - progress.value),
  }))
  return <Animated.View style={[styles.bar, pad]}>{children}</Animated.View>
}

function Notice({ text, children }: { text: string; children?: ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Text variant="callout" color="textMuted" align="center">
        {text}
      </Text>
      {children}
    </View>
  )
}

function OlderLoader({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  if (loading) {
    return (
      <View style={styles.older} accessible accessibilityLabel="Cargando mensajes anteriores">
        <ActivityIndicator color={theme.textMuted} />
      </View>
    )
  }
  if (!error) return null
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel={`${error}. Reintentar`}
      style={({ pressed }) => [styles.older, pressed ? styles.olderPressed : null]}
    >
      <Text variant="footnote" color="textMuted" align="center">
        {error}
      </Text>
      <Text variant="footnote" color="accentText">
        Reintentar
      </Text>
    </Pressable>
  )
}

const SKELETON = [
  { mine: false, width: '62%' },
  { mine: false, width: '40%' },
  { mine: true, width: '55%' },
  { mine: false, width: '48%' },
  { mine: true, width: '70%' },
  { mine: true, width: '36%' },
] as const

function ConversationSkeleton() {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.skeleton} accessible accessibilityLabel="Cargando conversación" accessibilityRole="progressbar">
      {SKELETON.map((b, i) => (
        <Skeleton
          key={i}
          width={b.width}
          height={space.xxl + space.sm}
          radius={radius.md}
          style={b.mine ? styles.skeletonMine : undefined}
        />
      ))}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    list: { paddingHorizontal: space.gutter, paddingVertical: space.md, flexGrow: 1 },
    bar: {
      paddingHorizontal: space.md,
      paddingTop: space.sm,
      backgroundColor: t.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    notice: { gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
    older: { alignItems: 'center', gap: space.xs, paddingVertical: space.lg, borderRadius: radius.sm },
    olderPressed: { backgroundColor: t.surface2 },
    skeleton: { flex: 1, justifyContent: 'flex-end', gap: space.md, padding: space.gutter },
    skeletonMine: { alignSelf: 'flex-end' },
  })
