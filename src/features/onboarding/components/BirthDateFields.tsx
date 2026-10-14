import { useRef, type RefObject } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { space, Text, TextField, useStyles, type Theme } from '@/ui'

export type DatePart = 'day' | 'month' | 'year'

type BirthDateFieldsProps = {
  day: string
  month: string
  year: string
  onChange: (part: DatePart, value: string) => void
  error?: string | null
  helper?: string
  editable?: boolean
  dayRef?: RefObject<TextInput | null>
}

const MAX = { day: 2, month: 2, year: 4 } as const

// Tres campos numéricos en orden colombiano (día/mes/año): sin selector nativo ni dependencias,
// y el foco salta solo al completar cada parte.
export function BirthDateFields({ day, month, year, onChange, error, helper, editable = true, dayRef }: BirthDateFieldsProps) {
  const styles = useStyles(makeStyles)
  const monthRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)
  const hint = error ?? helper

  const handle = (part: DatePart, raw: string) => {
    const value = raw.replace(/\D/g, '').slice(0, MAX[part])
    onChange(part, value)
    if (value.length < MAX[part]) return
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
      <Text variant="callout" color="textMuted">
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
            value={day}
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
            value={month}
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
            value={year}
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
