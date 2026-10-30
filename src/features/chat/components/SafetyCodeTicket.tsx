import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {
  font,
  Icon,
  motion,
  radius,
  ShieldCheckIcon,
  space,
  Text,
  TicketCard,
  type,
  useStyles,
  useTheme,
  type Theme,
} from '@/ui'
import { QrSvg } from '../qr/QrSvg'

type Props = {
  peerName: string
  blocks: string[]
  qrPayload: string | null
  verified: boolean
  // true solo justo después de verificar: el sello "cae" una vez; al volver a la pantalla ya está puesto.
  stampAnimated: boolean
}

const QR_SIZE = 184
const COLUMNS = 3

const spoken = (block: string) => block.split('').join(' ')

// El código como número de serie de una boleta: 12 bloques de 5 en 4 filas de 3, en mono.
export function SafetyCodeTicket({ peerName, blocks, qrPayload, verified, stampAnimated }: Props) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const rows: string[][] = []
  for (let i = 0; i < blocks.length; i += COLUMNS) rows.push(blocks.slice(i, i + COLUMNS))

  return (
    <TicketCard
      stub={
        qrPayload ? (
          <View style={styles.stub}>
            <QrSvg
              value={qrPayload}
              size={QR_SIZE}
              color={theme.onTicket}
              background={theme.ticket}
              accessibilityLabel={`Código QR de seguridad entre tú y ${peerName}`}
            />
            <Text variant="caption" color="onTicketMuted" align="center">
              Que {peerName} lo escanee desde su chat contigo
            </Text>
          </View>
        ) : null
      }
    >
      <Text variant="caption" color="onTicketMuted">
        Tú y {peerName}
      </Text>
      <View
        style={styles.grid}
        accessible
        accessibilityLabel={`Código de seguridad: ${blocks.map(spoken).join(', ')}`}
      >
        {rows.map((row, r) => (
          <View key={r} style={styles.gridRow}>
            {row.map((block, c) => (
              <Text key={c} variant="data" color="onTicket" style={styles.block} maxFontSizeMultiplier={1.5}>
                {block}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {verified ? <VerifiedStamp animated={stampAnimated} /> : null}
    </TicketCard>
  )
}

function VerifiedStamp({ animated }: { animated: boolean }) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const reduced = useReducedMotion()
  const progress = useSharedValue(animated ? 0 : 1)

  useEffect(() => {
    if (!animated) return
    progress.value = withTiming(1, {
      duration: motion.duration.base,
      easing: Easing.bezier(...motion.easeOut),
      reduceMotion: ReduceMotion.System,
    })
  }, [animated, progress])

  // Un sello se "estampa": baja de un poco más grande a su tamaño. Con movimiento reducido, solo aparece.
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduced ? 1 : 1.12 - 0.12 * progress.value }],
  }))

  return (
    <Animated.View
      style={[styles.stamp, { borderColor: theme.ticketVerified }, style]}
      accessible
      accessibilityLabel="Verificado"
    >
      <Icon icon={ShieldCheckIcon} size={20} color="ticketVerified" weight="fill" />
      <Text variant="headline" style={[styles.stampText, { color: theme.ticketVerified }]}>
        VERIFICADO
      </Text>
    </Animated.View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    grid: { gap: space.sm, paddingTop: space.sm },
    gridRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.md },
    block: { fontSize: type.data.fontSize + 5, lineHeight: type.data.lineHeight + 8, letterSpacing: 1 },
    stub: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
    // En flujo (no absoluto): con letra grande el sello nunca tapa el código.
    stamp: {
      alignSelf: 'flex-start',
      marginTop: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs,
      borderWidth: 2,
      borderRadius: radius.sm,
    },
    stampText: { fontFamily: font.title, letterSpacing: 1 },
  })
