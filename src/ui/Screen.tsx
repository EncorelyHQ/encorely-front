import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import { useStyles, useTheme } from './theme'
import { space, type Theme } from './tokens'

type ScreenProps = {
  children: ReactNode
  // 'scroll' para contenido largo, 'form' cuando hay campos (evita que el teclado los tape), 'fixed' para layouts propios.
  mode?: 'fixed' | 'scroll' | 'form'
  // Bordes con safe area. Las pantallas con header nativo no necesitan 'top'.
  edges?: Edge[]
  padded?: boolean
  footer?: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: ViewStyle
}

export function Screen({
  children,
  mode = 'fixed',
  edges = ['top'],
  padded = true,
  footer,
  refreshing,
  onRefresh,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') && !footer ? insets.bottom : 0,
  }
  const inner = [padded ? styles.padded : null, contentStyle]

  const refresh = onRefresh ? (
    <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
  ) : undefined

  return (
    <View style={[styles.root, pad]}>
      {mode === 'fixed' ? (
        <View style={[styles.flex, ...inner]}>{children}</View>
      ) : mode === 'scroll' ? (
        <ScrollView
          contentContainerStyle={[styles.grow, ...inner]}
          refreshControl={refresh}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.grow, ...inner]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={space.xl}
        >
          {children}
        </KeyboardAwareScrollView>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>{footer}</View>
      ) : null}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    flex: { flex: 1 },
    grow: { flexGrow: 1 },
    padded: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
    footer: {
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
      gap: space.sm,
      backgroundColor: t.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
  })
