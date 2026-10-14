import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { MatchSummary } from '@/lib/api/types'
import { Avatar, radius, space, Text, touch, useStyles, type Theme } from '@/ui'
import { formatListTime } from '../data/format'

type RowProps = {
  match: MatchSummary
  reason: string
  now: number
  onPress: (match: MatchSummary) => void
}

// Fila de conversación. En v1 el subtítulo es el motivo del match, no el último mensaje: mostrarlo obligaría
// a descifrar el historial de todos los chats solo para pintar la lista.
function ChatRowBase({ match, reason, now, onPress }: RowProps) {
  const styles = useStyles(makeStyles)
  const name = match.peer.displayName
  const time = match.lastMessageAt ? formatListTime(Date.parse(match.lastMessageAt), now) : null
  return (
    <Pressable
      onPress={() => onPress(match)}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${reason}${time ? `. Último mensaje: ${time}` : ''}`}
      accessibilityHint="Abre la conversación"
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Avatar name={name} size={AVATAR_ROW} />
      <View style={styles.texts}>
        <View style={styles.titleLine}>
          <Text variant="headline" numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          {time ? (
            <Text variant="data" color="textSubtle" numberOfLines={1}>
              {time}
            </Text>
          ) : null}
        </View>
        <Text variant="footnote" color="textMuted" numberOfLines={2}>
          {reason}
        </Text>
      </View>
    </Pressable>
  )
}

export const ChatRow = memo(ChatRowBase)

type StripProps = {
  matches: MatchSummary[]
  reasonFor: (match: MatchSummary) => string
  onPress: (match: MatchSummary) => void
}

// "Nuevos": matches sin mensajes. Fila horizontal de avatares, como en las apps de mensajería nativas.
export function NewMatchesStrip({ matches, reasonFor, onPress }: StripProps) {
  const styles = useStyles(makeStyles)
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      accessibilityRole="list"
    >
      {matches.map((match) => (
        <Pressable
          key={match.id}
          onPress={() => onPress(match)}
          accessibilityRole="button"
          accessibilityLabel={`${match.peer.displayName}, match nuevo. ${reasonFor(match)}`}
          accessibilityHint="Abre la conversación para escribirle"
          style={({ pressed }) => [styles.newItem, pressed ? styles.newPressed : null]}
        >
          <View style={styles.ring}>
            <Avatar name={match.peer.displayName} size={AVATAR_NEW} />
          </View>
          <Text variant="caption" numberOfLines={1} align="center" style={styles.newName}>
            {match.peer.displayName}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

// Separador con sangría desde el texto (no desde el avatar), como las listas nativas.
export function RowSeparator() {
  const styles = useStyles(makeStyles)
  return <View style={styles.separator} />
}

const AVATAR_ROW = 48
const AVATAR_NEW = 56
const RING = 2

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: touch.large + space.lg,
      paddingHorizontal: space.gutter,
      paddingVertical: space.md,
    },
    pressed: { backgroundColor: t.surface2 },
    texts: { flex: 1, gap: space.xs / 2 },
    titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    name: { flex: 1 },
    strip: { paddingHorizontal: space.gutter - space.xs, gap: space.xs },
    newItem: {
      width: AVATAR_NEW + space.xl,
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.sm,
      borderRadius: radius.sm,
    },
    // Respuesta inmediata al toque: el avatar "cede" un poco, sin animación que retrase la navegación.
    newPressed: { backgroundColor: t.surface2, transform: [{ scale: 0.97 }] },
    // Anillo color manilla: lo nuevo se distingue sin badge ni número.
    ring: {
      padding: RING,
      borderRadius: radius.full,
      borderWidth: RING,
      borderColor: t.accent,
    },
    newName: { alignSelf: 'stretch' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: space.gutter + AVATAR_ROW + space.md },
  })
