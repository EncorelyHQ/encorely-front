import { ScrollView, StyleSheet } from 'react-native'
import { Chip, space } from '@/ui'

type CityFilterProps = {
  options: readonly string[]
  value: string | undefined
  onChange: (city: string | undefined) => void
}

// Filtro de una sola opción: "Todas" equivale a no mandar ciudad al back.
export function CityFilter({ options, value, onChange }: CityFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Filtrar por ciudad"
    >
      <Chip label="Todas" selected={value === undefined} onPress={() => onChange(undefined)} />
      {options.map((city) => (
        <Chip key={city} label={city} selected={value === city} onPress={() => onChange(city)} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.gutter },
})
