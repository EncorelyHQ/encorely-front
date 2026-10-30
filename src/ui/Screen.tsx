import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { RefreshControl, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context'
import { ScreenScrollProvider } from './scroll'
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

  // El scroll vive en el hilo de UI para que ScrollReveal, ParallaxTicket y los stickers lo sigan sin pasar por JS.
  const scrollY = useSharedValue(0)
  const viewportBottom = useSharedValue(Number.MAX_SAFE_INTEGER)
  const viewportRef = useRef<View>(null)
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  const measureViewport = useCallback(() => {
    viewportRef.current?.measureInWindow((_x, y, _w, height) => {
      if (height > 0) viewportBottom.value = y + height
    })
  }, [viewportBottom])
  const scroll = useMemo(() => ({ y: scrollY, viewportBottom }), [scrollY, viewportBottom])

  const refresh = onRefresh ? (
    <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />
  ) : undefined

  return (
    <View style={[styles.root, pad]}>
      {mode === 'fixed' ? (
        <View style={[styles.flex, ...inner]}>{children}</View>
      ) : mode === 'scroll' ? (
        <ScreenScrollProvider value={scroll}>
          <View ref={viewportRef} style={styles.flex} onLayout={measureViewport}>
            <Animated.ScrollView
              contentContainerStyle={[styles.grow, ...inner]}
              refreshControl={refresh}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
            >
              {children}
            </Animated.ScrollView>
          </View>
        </ScreenScrollProvider>
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
