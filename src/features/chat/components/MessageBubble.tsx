import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated'
import {
  ArrowsClockwiseIcon,
  Icon,
  LockKeyOpenIcon,
  motion,
  radius,
  space,
  Text,
  touch,
  useStyles,
  type Theme,
} from '@/ui'
import { formatClock } from '../data/format'
import type { ChatMessage } from '../data/messages'

type Props = {
  message: ChatMessage
  peerName: string
  firstInGroup: boolean
  lastInGroup: boolean
  onRetry: (id: string) => void
}

// Esquina "pegada" entre burbujas del mismo grupo: la forma dice que son un solo turno.
const JOINED_CORNER = space.xs
const ease = Easing.bezier(...motion.easeOut)

function a11yLabel(message: ChatMessage, peerName: string): string {
  const who = message.mine ? 'Tú' : peerName
  if (message.status === 'undecryptable') return `${who}: no se pudo descifrar este mensaje`
  const time = formatClock(message.at)
  const state =
    message.status === 'sending' ? ', enviando' : message.status === 'failed' ? ', no se envió' : ''
  return `${who}, ${time}${state}: ${message.body ?? ''}`
}

function MessageBubbleBase({ message, peerName, firstInGroup, lastInGroup, onRetry }: Props) {
  const styles = useStyles(makeStyles)
  const { mine, status } = message
  const undecryptable = status === 'undecryptable'

  const corners = mine
    ? {
        borderTopRightRadius: firstInGroup ? radius.md : JOINED_CORNER,
        borderBottomRightRadius: lastInGroup ? radius.md : JOINED_CORNER,
      }
    : {
        borderTopLeftRadius: firstInGroup ? radius.md : JOINED_CORNER,
        borderBottomLeftRadius: lastInGroup ? radius.md : JOINED_CORNER,
      }

  return (
    <Animated.View
      // Solo lo que acabo de enviar entra con movimiento; el historial aparece quieto.
      entering={
        status === 'sending'
          ? FadeInDown.duration(motion.duration.fast).easing(ease).reduceMotion(ReduceMotion.System)
          : undefined
      }
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, firstInGroup ? styles.groupStart : null]}
    >
      <View
        accessible
        accessibilityLabel={a11yLabel(message, peerName)}
        style={[
          styles.bubble,
          corners,
          undecryptable ? styles.undecryptable : mine ? styles.mine : styles.theirs,
          status === 'sending' ? styles.sending : null,
        ]}
      >
        {undecryptable ? (
          <View style={styles.undecryptableContent}>
            <Icon icon={LockKeyOpenIcon} size={16} color="textSubtle" />
            <Text variant="footnote" color="textMuted" style={styles.flexText}>
              No se pudo descifrar este mensaje
            </Text>
          </View>
        ) : (
          <Text variant="body" color={mine ? 'onAccent' : 'text'} selectable>
            {message.body}
          </Text>
        )}
      </View>

      {status === 'failed' ? (
        <Pressable
          onPress={() => onRetry(message.id)}
          accessibilityRole="button"
          accessibilityLabel="No se envió. Reintentar"
          hitSlop={space.sm}
          style={({ pressed }) => [styles.retry, pressed ? styles.retryPressed : null]}
        >
          <Icon icon={ArrowsClockwiseIcon} size={16} color="danger" />
          <Text variant="caption" color="danger">
            No se envió · Reintentar
          </Text>
        </Pressable>
      ) : lastInGroup && !undecryptable ? (
        // La hora va fuera de la burbuja: textMuted sobre bg pasa AA holgado; dentro del naranja no.
        <Text variant="caption" color="textMuted" style={styles.meta} importantForAccessibility="no">
          {status === 'sending' ? 'Enviando…' : formatClock(message.at)}
        </Text>
      ) : null}
    </Animated.View>
  )
}

export const MessageBubble = memo(MessageBubbleBase)

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { maxWidth: '82%', marginTop: space.xs / 2 },
    rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    groupStart: { marginTop: space.md },
    bubble: {
      borderRadius: radius.md,
      paddingHorizontal: space.md + space.xs / 2,
      paddingVertical: space.sm,
    },
    mine: { backgroundColor: t.accent },
    theirs: { backgroundColor: t.surface2 },
    // Mientras se envía, la burbuja propia se ve "en tránsito" sin bajar el texto de AA (6.6 → ~5.1 con 0.85).
    sending: { opacity: 0.85 },
    undecryptable: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: t.borderInput,
      backgroundColor: 'transparent',
    },
    undecryptableContent: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    flexText: { flexShrink: 1 },
    meta: { marginTop: space.xs, paddingHorizontal: space.xs },
    retry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      minHeight: touch.min,
      paddingHorizontal: space.sm,
      borderRadius: radius.sm,
    },
    retryPressed: { backgroundColor: t.surface2 },
  })
