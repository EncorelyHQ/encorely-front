import { useRef } from 'react'
import { StyleSheet, View, type TextInput } from 'react-native'
import { Button, IconButton, space, Text, TextField, useStyles, XIcon, type Theme } from '@/ui'
import { EVENT_LIMITS } from '../model/eventForm'
import { PlusIcon } from '../icons'

type LineupEditorProps = {
  value: string[]
  onChange: (value: string[]) => void
  error?: string
}

// Lista editable: un campo por artista, en el orden del cartel. Siempre queda al menos un campo.
export function LineupEditor({ value, onChange, error }: LineupEditorProps) {
  const styles = useStyles(makeStyles)
  const inputs = useRef<(TextInput | null)[]>([])
  const canAdd = value.length < EVENT_LIMITS.lineupMax

  const update = (index: number, text: string) => onChange(value.map((v, i) => (i === index ? text : v)))
  const remove = (index: number) => {
    const next = value.filter((_, i) => i !== index)
    onChange(next.length > 0 ? next : [''])
  }
  const add = () => {
    onChange([...value, ''])
    // El campo nuevo existe en el siguiente render.
    requestAnimationFrame(() => inputs.current[value.length]?.focus())
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text variant="callout" color="textMuted" accessibilityRole="header">
          Artistas
        </Text>
        <Text variant="footnote" color="textSubtle">
          En el orden del cartel: el primero es el principal.
        </Text>
      </View>
      {value.map((artist, index) => (
        <View key={index} style={styles.row}>
          <View style={styles.field}>
            <TextField
              ref={(node) => {
                inputs.current[index] = node
              }}
              label={index === 0 ? 'Artista principal' : `Artista ${index + 1}`}
              value={artist}
              onChangeText={(text) => update(index, text)}
              autoCapitalize="words"
              returnKeyType={index === value.length - 1 && canAdd ? 'next' : 'done'}
              onSubmitEditing={() => {
                if (index === value.length - 1 && canAdd && artist.trim()) add()
              }}
              submitBehavior={index === value.length - 1 && canAdd && artist.trim() ? 'submit' : 'blurAndSubmit'}
            />
          </View>
          {value.length > 1 ? (
            <View style={styles.remove}>
              <IconButton
                icon={XIcon}
                label={`Quitar ${artist.trim() || `artista ${index + 1}`}`}
                color="textMuted"
                onPress={() => remove(index)}
              />
            </View>
          ) : null}
        </View>
      ))}
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {canAdd ? (
        <Button label="Agregar artista" variant="ghost" icon={PlusIcon} fullWidth={false} onPress={add} />
      ) : (
        <Text variant="footnote" color="textSubtle">
          Llegaste al máximo de {EVENT_LIMITS.lineupMax} artistas.
        </Text>
      )}
    </View>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.md },
    heading: { gap: 2 },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
    field: { flex: 1 },
    // Alinea la X con la caja del campo (no con la etiqueta).
    remove: { paddingBottom: space.xs },
  })
