import { useRef, type RefObject } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { space, Text, TextField, useStyles, type Theme } from '@/ui'
import { onlyDigits, type BirthDateParts } from '../validation'

type BirthDateFieldsProps = {
  value: BirthDateParts
  onChange: (value: BirthDateParts) => void
  error?: string | null
  editable?: boolean
}

// Tres campos numéricos en vez de un date picker: sin librerías nuevas y rápido de escribir con el teclado numérico.
export function BirthDateFields({ value, onChange, error, editable = true }: BirthDateFieldsProps) {
  const styles = useStyles(makeStyles)
  const monthRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)

  const update = (key: keyof BirthDateParts, raw: string, max: number, next?: RefObject<TextInput | null>) => {
    const digits = onlyDigits(raw).slice(0, max)
    // Salta al siguiente campo solo cuando se acaba de completar escribiendo, no al borrar o corregir.
    if (next && digits.length === max && value[key].length < max) next.current?.focus()
    onChange({ ...value, [key]: digits })
  }

  return (
    <View style={styles.wrap}>
      <Text variant="callout" color="textMuted" accessibilityRole="header">
        Fecha de nacimiento
      </Text>
      <View style={styles.row}>
        <View style={styles.short}>
          <TextField
            label="Día"
            accessibilityLabel="Día de nacimiento"
            value={value.day}
            onChangeText={(t) => update('day', t, 2, monthRef)}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="DD"
            returnKeyType="next"
            onSubmitEditing={() => monthRef.current?.focus()}
            editable={editable}
          />
        </View>
        <View style={styles.short}>
          <TextField
            ref={monthRef}
            label="Mes"
            accessibilityLabel="Mes de nacimiento, de 1 a 12"
            value={value.month}
            onChangeText={(t) => update('month', t, 2, yearRef)}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="MM"
            returnKeyType="next"
            onSubmitEditing={() => yearRef.current?.focus()}
            editable={editable}
          />
        </View>
        <View style={styles.long}>
          <TextField
            ref={yearRef}
            label="Año"
            accessibilityLabel="Año de nacimiento, cuatro cifras"
            value={value.year}
            onChangeText={(t) => update('year', t, 4)}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="AAAA"
            editable={editable}
          />
        </View>
      </View>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text variant="footnote" color="textSubtle">
          Necesitas tener 18 años o más. Los demás solo ven tu edad, no la fecha.
        </Text>
      )}
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.xs + 2 },
    row: { flexDirection: 'row', gap: space.md },
    short: { flex: 1 },
    long: { flex: 1.5 },
  })
