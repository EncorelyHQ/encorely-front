import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import { CaretRightIcon as CaretRight } from './icons'
import { haptics } from './haptics'
import { Icon, type PhosphorIcon } from './Icon'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { space, touch, type Theme } from './tokens'

type ListRowProps = {
  title: string
  subtitle?: string
  icon?: PhosphorIcon
  leading?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  destructive?: boolean
  chevron?: boolean
  switchValue?: boolean
  onSwitchChange?: (value: boolean) => void
  accessibilityHint?: string
}

export function ListRow({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  onPress,
  destructive,
  chevron = !!onPress,
  switchValue,
  onSwitchChange,
  accessibilityHint,
}: ListRowProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const hasSwitch = onSwitchChange !== undefined

  const content = (
    <>
      {leading ?? (icon ? <Icon icon={icon} size={24} color={destructive ? 'danger' : 'textMuted'} /> : null)}
      <View style={styles.texts}>
        <Text variant="body" color={destructive ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {hasSwitch ? (
        <Switch
          value={!!switchValue}
          onValueChange={(v) => {
            haptics.selection()
            onSwitchChange?.(v)
          }}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.text}
          accessibilityLabel={title}
        />
      ) : null}
      {chevron && !hasSwitch ? <Icon icon={CaretRight} size={20} color="textSubtle" /> : null}
    </>
  )

  if (!onPress) {
    return <View style={styles.row}>{content}</View>
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: theme.surface2 } : null]}
    >
      {content}
    </Pressable>
  )
}

export function ListSection({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.section}>
      {title ? (
        <Text variant="footnote" color="textMuted" style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>{children}</View>
      {footer ? (
        <Text variant="footnote" color="textSubtle" style={styles.sectionFooter}>
          {footer}
        </Text>
      ) : null}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: touch.comfortable + 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: t.surface,
    },
    texts: { flex: 1, gap: 2 },
    section: { gap: space.sm },
    sectionTitle: { paddingHorizontal: space.lg },
    sectionFooter: { paddingHorizontal: space.lg },
    group: {
      borderRadius: 12,
      overflow: 'hidden',
      gap: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
    },
  })
