import { useRef, type RefObject } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { space, Text, TextField, useStyles, type Theme } from '@/ui'
import { onlyDigits, type BirthDateParts } from './profileRules'

type BirthDateFieldsProps = {
  value: BirthDateParts
  onChange: (value: BirthDateParts) => void
  error?: string | null
  helper?: string
  editable?: boolean
  dayRef?: RefObject<TextInput | null>
}

const MAX = { day: 2, month: 2, year: 4 } as const

// Tres campos numéricos en orden colombiano (día/mes/año): sin selector nativo ni dependencias,
// y el foco salta solo al completar cada parte.
export function BirthDateFields({ value, onChange, error, helper, editable = true, dayRef }: BirthDateFieldsProps) {
  const styles = useStyles(makeStyles)
  const monthRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)
  const hint = error ?? helper

  const handle = (part: keyof BirthDateParts, raw: string) => {
    const digits = onlyDigits(raw).slice(0, MAX[part])
    onChange({ ...value, [part]: digits })
    // Salta al siguiente campo solo cuando se acaba de completar escribiendo, no al borrar o corregir.
    if (digits.length < MAX[part] || value[part].length >= MAX[part]) return
    if (part === 'day') monthRef.current?.focus()
    else if (part === 'month') yearRef.current?.focus()
  }

  const common = {
    keyboardType: 'number-pad' as const,
    inputMode: 'numeric' as const,
    editable,
    selectTextOnFocus: true,
    style: [styles.input, error ? styles.inputError : null],
  }

  return (
    <View style={styles.wrap}>
      <Text variant="callout" color="textMuted" accessibilityRole="header">
        Fecha de nacimiento
      </Text>
      <View style={styles.row}>
        <View style={styles.short}>
          <TextField
            {...common}
            ref={dayRef}
            label="Día"
            accessibilityLabel="Día de nacimiento"
            accessibilityHint={hint}
            placeholder="DD"
            value={value.day}
            maxLength={MAX.day}
            onChangeText={(value) => handle('day', value)}
            textContentType="birthdateDay"
            autoComplete="birthdate-day"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => monthRef.current?.focus()}
          />
        </View>
        <View style={styles.short}>
          <TextField
            {...common}
            ref={monthRef}
            label="Mes"
            accessibilityLabel="Mes de nacimiento, en número"
            accessibilityHint={hint}
            placeholder="MM"
            value={value.month}
            maxLength={MAX.month}
            onChangeText={(value) => handle('month', value)}
            textContentType="birthdateMonth"
            autoComplete="birthdate-month"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => yearRef.current?.focus()}
          />
        </View>
        <View style={styles.long}>
          <TextField
            {...common}
            ref={yearRef}
            label="Año"
            accessibilityLabel="Año de nacimiento"
            accessibilityHint={hint}
            placeholder="AAAA"
            value={value.year}
            maxLength={MAX.year}
            onChangeText={(value) => handle('year', value)}
            textContentType="birthdateYear"
            autoComplete="birthdate-year"
            returnKeyType="done"
          />
        </View>
      </View>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="footnote" color="textSubtle">
          {helper}
        </Text>
      ) : null}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.sm },
    row: { flexDirection: 'row', gap: space.md },
    short: { flex: 1 },
    long: { flex: 1.5 },
    input: { textAlign: 'center' },
    inputError: { borderColor: t.danger, borderWidth: 2 },
  })
