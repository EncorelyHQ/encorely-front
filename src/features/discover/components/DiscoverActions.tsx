import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { HeartIcon, IconButton, PauseIcon, PlayIcon, space, XIcon } from '@/ui'

type DiscoverActionsProps = {
  disabled?: boolean
  hasPreview: boolean
  isPlaying: boolean
  onPass: () => void
  onLike: () => void
  onTogglePreview: () => void
}

// Fila fija en la zona del pulgar: todo el flujo funciona sin gestos (WCAG 2.5.7).
export const DiscoverActions = memo(function DiscoverActions({
  disabled,
  hasPreview,
  isPlaying,
  onPass,
  onLike,
  onTogglePreview,
}: DiscoverActionsProps) {
  const previewLabel = !hasPreview ? 'Sin vista previa' : isPlaying ? 'Pausar vista previa' : 'Reproducir vista previa'
  return (
    <View style={styles.row}>
      <IconButton icon={XIcon} label="Paso" size="xl" tone="outline" weight="bold" onPress={onPass} disabled={disabled} />
      <IconButton
        icon={isPlaying ? PauseIcon : PlayIcon}
        label={previewLabel}
        size="lg"
        tone="filled"
        weight="fill"
        onPress={onTogglePreview}
        disabled={disabled || !hasPreview}
        accessibilityState={{ disabled: disabled || !hasPreview, selected: isPlaying }}
      />
      <IconButton icon={HeartIcon} label="Me gusta" size="xl" tone="accent" weight="fill" onPress={onLike} disabled={disabled} />
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxl,
    paddingTop: space.lg,
    paddingBottom: space.lg,
  },
})
