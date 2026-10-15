import { ChatCircleTextIcon } from 'phosphor-react-native/src/icons/ChatCircleText'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'
import { affinityPercent, affinitySentence } from '@/features/social'
import type { RadarPerson } from '@/lib/api/types'
import { Avatar, Button, CheckIcon, HeartIcon, Icon, Skeleton, Text, motion, radius, space, touch, useStyles, type Theme } from '@/ui'

type RadarPersonRowProps = {
  person: RadarPerson
  // Frase ya legible: "salsa y rock en español".
  genres: string
  onLike: (person: RadarPerson) => void
  onOpenChat: (person: RadarPerson) => void
  liking: boolean
  openingChat: boolean
}

export function RadarPersonRow({ person, genres, onLike, onOpenChat, liking, openingChat }: RadarPersonRowProps) {
  const styles = useStyles(makeStyles)
  const facts = [person.age ? `${person.age} años` : null, person.city].filter(Boolean).join(' · ')
  const summary = [
    person.displayName,
    facts,
    genres ? `Les gusta ${genres}` : null,
    // Sin señal suficiente de alguno de los dos el back manda null: mejor ningún número que uno inventado.
    affinitySentence(person.affinity),
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <View style={styles.row}>
      <View style={styles.top} accessible accessibilityLabel={summary}>
        <Avatar name={person.displayName} size={48} />
        <View style={styles.identity}>
          <Text variant="headline" numberOfLines={2}>
            {person.displayName}
          </Text>
          {facts ? (
            <Text variant="footnote" color="textMuted">
              {facts}
            </Text>
          ) : null}
        </View>
        {person.affinity === null ? null : (
          <View style={styles.affinity}>
            <Text variant="data" color="textMuted">
              {affinityPercent(person.affinity)}
            </Text>
            <Text variant="footnote" color="textMuted">
              en común
            </Text>
          </View>
        )}
      </View>

      {genres ? (
        <Text variant="footnote" color="textMuted" style={styles.indented} importantForAccessibility="no">
          Les gusta: {genres}
        </Text>
      ) : null}

      <View style={[styles.indented, styles.action]}>
        {person.matched ? (
          <View style={styles.matched}>
            <Button
              label="Escribir"
              variant="primary"
              size="md"
              icon={ChatCircleTextIcon}
              fullWidth={false}
              loading={openingChat}
              accessibilityHint={`Hicieron match. Abre el chat con ${person.displayName}`}
              onPress={() => onOpenChat(person)}
            />
            <Text variant="caption" color="verified">
              Hicieron match
            </Text>
          </View>
        ) : person.likedByMe ? (
          <Animated.View
            entering={FadeIn.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
            style={styles.liked}
            accessible
            accessibilityLabel={`Te interesa ${person.displayName}`}
          >
            <Icon icon={CheckIcon} size={16} color="textMuted" weight="bold" />
            <Text variant="callout" color="textMuted">
              Te interesa
            </Text>
          </Animated.View>
        ) : (
          <Button
            label="Me interesa"
            variant="secondary"
            size="md"
            icon={HeartIcon}
            fullWidth={false}
            disabled={liking}
            accessibilityHint={`Si a ${person.displayName} también le interesas, harán match`}
            onPress={() => onLike(person)}
          />
        )}
      </View>
    </View>
  )
}

export function RadarPersonSkeleton() {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.row} accessible={false}>
      <View style={styles.top}>
        <Skeleton width={AVATAR} height={AVATAR} radius={radius.full} />
        <View style={styles.identity}>
          <Skeleton width="50%" height={18} />
          <Skeleton width="35%" height={14} />
        </View>
      </View>
      <View style={styles.indented}>
        <Skeleton width={136} height={touch.comfortable} radius={radius.full} />
      </View>
    </View>
  )
}

const AVATAR = 48

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      gap: space.sm,
      paddingVertical: space.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    identity: { flex: 1, gap: space.xs / 2 },
    affinity: { alignSelf: 'flex-start', alignItems: 'flex-end', flexShrink: 0, maxWidth: '40%' },
    // Alinea el texto con el nombre, no con el avatar.
    indented: { marginLeft: AVATAR + space.md },
    action: { alignItems: 'flex-start', marginTop: space.xs },
    matched: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md },
    liked: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: space.xxxl },
  })
