import { StyleSheet, Text as RNText, View } from 'react-native'
import { font, space, sticker, useTheme } from '@/ui'

// Cuántas reacciones tiene un sticker. Solo lo ve el dueño del perfil.
export function CountBadge({ count }: { count: number }) {
  const theme = useTheme()
  if (count <= 0) return null
  return (
    <View pointerEvents="none" style={[styles.badge, { borderColor: theme.ticket }]}>
      <RNText maxFontSizeMultiplier={1.3} style={styles.text}>
        {count > 99 ? '99+' : count}
      </RNText>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -space.md,
    right: -space.md,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: sticker.band.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  text: { fontFamily: font.data, fontSize: 13, color: sticker.band.fg },
})
