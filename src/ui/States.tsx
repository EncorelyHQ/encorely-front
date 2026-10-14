import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Button } from './Button'
import { Icon, type PhosphorIcon } from './Icon'
import { Text } from './Text'
import { useStyles, useTheme } from './theme'
import { radius, space, type Theme } from './tokens'

type Action = { label: string; onPress: () => void; loading?: boolean }

type EmptyStateProps = {
  icon?: PhosphorIcon
  title: string
  body?: string
  action?: Action
  secondaryAction?: Action
}

export function EmptyState({ icon, title, body, action, secondaryAction }: EmptyStateProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.state}>
      {icon ? <Icon icon={icon} size={40} color="textMuted" /> : null}
      <Text variant="title2" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="textMuted" align="center" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {action || secondaryAction ? (
        <View style={styles.actions}>
          {action ? <Button label={action.label} onPress={action.onPress} loading={action.loading} /> : null}
          {secondaryAction ? (
            <Button label={secondaryAction.label} variant="ghost" onPress={secondaryAction.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

type ErrorStateProps = { title?: string; message: string; onRetry?: () => void; retrying?: boolean }

export function ErrorState({ title = 'Algo falló', message, onRetry, retrying }: ErrorStateProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <Text variant="title2" align="center" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" color="textMuted" align="center" style={styles.body}>
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.actions}>
          <Button label="Reintentar" variant="secondary" onPress={onRetry} loading={retrying} />
        </View>
      ) : null}
    </View>
  )
}

export function LoadingState({ label }: { label: string }) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.state} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={theme.accent} size="large" />
      <Text variant="callout" color="textMuted">
        {label}
      </Text>
    </View>
  )
}

type SkeletonProps = { width?: DimensionValue; height: number; radius?: number; style?: ViewStyle }

// Pulso suave y finito en intención: se desmonta en cuanto llega el contenido.
export function Skeleton({ width = '100%', height, radius: r = radius.sm, style }: SkeletonProps) {
  const theme = useTheme()
  const reduced = useReducedMotion()
  const opacity = useSharedValue(0.55)

  useEffect(() => {
    if (reduced) return
    opacity.value = withRepeat(withTiming(1, { duration: 700, reduceMotion: ReduceMotion.System }), -1, true)
  }, [opacity, reduced])

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      accessible={false}
      style={[{ width, height, borderRadius: r, backgroundColor: theme.surface2 }, animated, style]}
    />
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    state: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.md,
      paddingHorizontal: space.gutter,
      paddingVertical: space.xxl,
    },
    body: { maxWidth: 340 },
    actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
  })
