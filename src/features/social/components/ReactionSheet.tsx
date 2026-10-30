import { Pressable, StyleSheet, View } from 'react-native'
import type { ReactionType } from '@/lib/api/types'
import { Button, CheckIcon, Icon, Sheet, Sticker, Text, radius, space, touch, useStyles, type Theme } from '@/ui'
import { REACTIONS } from '../stickers'
import type { ProfileTarget } from './PublicProfileBody'

type ReactionSheetProps = {
  target: ProfileTarget | null
  current: ReactionType | null
  personName: string
  onPick: (reaction: ReactionType | null) => void
  onClose: () => void
}

// Los tres stickers, con el que ya pusiste marcado. No cuentan para el match ni mandan aviso.
export function ReactionSheet({ target, current, personName, onPick, onClose }: ReactionSheetProps) {
  const styles = useStyles(makeStyles)
  return (
    <Sheet visible={!!target} onClose={onClose} title={target ? `Tu sticker para ${target.name}` : ''}>
      <Text variant="footnote" color="textMuted">
        {personName} verá tu nombre junto al sticker. No cuenta para el match ni le llega un aviso.
      </Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {REACTIONS.map((r) => {
          const selected = r.type === current
          return (
            <Pressable
              key={r.type}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={r.label}
              accessibilityHint={r.hint}
              onPress={() => onPick(r.type)}
              style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
            >
              <Sticker label={r.label} tone={r.tone} angle={-2} />
              <Text variant="footnote" color="textMuted" style={styles.hint}>
                {r.hint}
              </Text>
              {selected ? <Icon icon={CheckIcon} size={20} color="verified" weight="bold" /> : null}
            </Pressable>
          )
        })}
      </View>
      {current ? <Button label="Quitar mi sticker" variant="ghost" onPress={() => onPick(null)} /> : null}
    </Sheet>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    options: { gap: space.sm },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: touch.large,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
    },
    selected: { borderColor: t.verified, backgroundColor: t.surface2 },
    pressed: { backgroundColor: t.surface2 },
    hint: { flex: 1 },
  })
