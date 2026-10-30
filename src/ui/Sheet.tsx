import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from './Button'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, type Theme } from './tokens'

type SheetProps = {
  visible: boolean
  onClose: () => void
  title: string
  children?: ReactNode
}

// Hoja inferior con la marca. Para confirmaciones usa ConfirmSheet.
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <Text variant="title2" accessibilityRole="header">
            {title}
          </Text>
          {children}
        </View>
      </View>
    </Modal>
  )
}

type ConfirmSheetProps = {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
  children,
}: ConfirmSheetProps) {
  const styles = useStyles(makeStyles)
  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      <Text variant="body" color="textMuted">
        {message}
      </Text>
      {children}
      <View style={styles.actions}>
        <Button
          label={confirmLabel}
          variant={destructive ? 'destructive' : 'primary'}
          onPress={onConfirm}
          loading={loading}
        />
        <Button label="Cancelar" variant="ghost" onPress={onCancel} disabled={loading} />
      </View>
    </Sheet>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.scrim },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: radius.md + 4,
      borderTopRightRadius: radius.md + 4,
      paddingHorizontal: space.gutter,
      paddingTop: space.sm,
      gap: space.md,
    },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space.sm },
    actions: { gap: space.sm, marginTop: space.sm },
  })
