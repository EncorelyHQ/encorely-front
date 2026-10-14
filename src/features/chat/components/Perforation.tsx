import { StyleSheet, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useTheme } from '@/ui'

// Línea perforada de boleta (mismo trazo que el talón de TicketCard). Decorativa.
export function Perforation() {
  const theme = useTheme()
  return (
    <View style={styles.wrap} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={2}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={theme.border} strokeWidth={1.5} strokeDasharray="4 5" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, height: 2, justifyContent: 'center' },
})
