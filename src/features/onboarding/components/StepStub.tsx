import { StyleSheet, View } from 'react-native'
import Svg, { Line } from 'react-native-svg'
import { radius, space, Text, useStyles, useTheme, type Theme } from '@/ui'

type StepStubProps = { step: number; total: number }

const STROKE = 2

// Progreso como talón numerado: el número va en un recuadro de boleta y lo que falta se ve perforado.
export function StepStub({ step, total }: StepStubProps) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const segments = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${step} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
    >
      <View style={styles.stub}>
        <Text variant="data">
          {step}/{total}
        </Text>
      </View>
      <View style={styles.track}>
        {segments.map((n) =>
          n <= step ? (
            <View key={n} style={styles.done} />
          ) : (
            <Svg key={n} height={STROKE} style={styles.pending}>
              <Line
                x1="0"
                y1={STROKE / 2}
                x2="100%"
                y2={STROKE / 2}
                stroke={theme.borderInput}
                strokeWidth={STROKE}
                strokeDasharray="4 5"
              />
            </Svg>
          ),
        )}
      </View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    stub: {
      borderWidth: 1.5,
      borderColor: t.borderInput,
      borderRadius: radius.sm,
      paddingHorizontal: space.sm,
      paddingVertical: space.xs / 2,
    },
    track: { flex: 1, flexDirection: 'row', gap: space.xs },
    done: { flex: 1, height: STROKE, backgroundColor: t.accent },
    pending: { flex: 1 },
  })
