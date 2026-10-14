import { useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { useStyles, useTheme } from './theme'
import { radius, space, type Theme } from './tokens'

type TicketCardProps = {
  children: ReactNode
  // Talón: la parte que queda bajo la línea perforada (código, fecha, sello).
  stub?: ReactNode
  style?: ViewStyle
}

const NOTCH = 10

// Componente firma de la marca. Solo se usa en match, evento y verificación del chat (03 §5.4).
export function TicketCard({ children, stub, style }: TicketCardProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const [width, setWidth] = useState(0)

  return (
    <View style={[styles.card, style]}>
      <View style={styles.body}>{children}</View>
      {stub ? (
        <>
          <View style={styles.perforation} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
            <View style={[styles.notch, styles.notchLeft, { backgroundColor: theme.bg }]} />
            {width > 0 ? (
              <Svg width={width} height={2} style={styles.line}>
                <Line
                  x1={NOTCH + 4}
                  y1={1}
                  x2={width - NOTCH - 4}
                  y2={1}
                  stroke={theme.onTicketMuted}
                  strokeWidth={1.5}
                  strokeDasharray="4 5"
                />
              </Svg>
            ) : null}
            <View style={[styles.notch, styles.notchRight, { backgroundColor: theme.bg }]} />
          </View>
          <View style={styles.stub}>{stub}</View>
        </>
      ) : null}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: t.ticket, borderRadius: radius.md, overflow: 'hidden' },
    body: { padding: space.lg + 4, gap: space.sm },
    perforation: { height: NOTCH * 2, justifyContent: 'center' },
    line: { position: 'absolute', left: 0 },
    notch: { position: 'absolute', width: NOTCH * 2, height: NOTCH * 2, borderRadius: NOTCH, top: 0 },
    notchLeft: { left: -NOTCH },
    notchRight: { right: -NOTCH },
    stub: { paddingHorizontal: space.lg + 4, paddingBottom: space.lg, paddingTop: space.xs, gap: space.xs },
  })
