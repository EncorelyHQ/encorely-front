import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { IconButton, PauseIcon, PlayIcon, touch, useTheme } from '@/ui'

type PreviewButtonProps = {
  title: string
  playing: boolean
  loading: boolean
  onPress: () => void
}

export function PreviewButton({ title, playing, loading, onPress }: PreviewButtonProps) {
  const theme = useTheme()
  if (loading) {
    return (
      <View style={styles.box} accessible accessibilityRole="progressbar" accessibilityLabel={`Cargando vista previa de ${title}`}>
        <ActivityIndicator color={theme.textMuted} />
      </View>
    )
  }
  return (
    <IconButton
      icon={playing ? PauseIcon : PlayIcon}
      label={playing ? `Pausar vista previa de ${title}` : `Escuchar vista previa de ${title}`}
      tone="outline"
      weight="fill"
      onPress={onPress}
    />
  )
}

const styles = StyleSheet.create({
  box: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
})
