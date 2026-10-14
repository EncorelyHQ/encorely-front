import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { radius, useTheme } from '@/ui'

// Portada decorativa: el título y el artista ya se leen al lado.
export function Cover({ uri, size }: { uri: string; size: 48 | 56 | 96 }) {
  const theme = useTheme()
  return (
    <Image
      source={uri ? { uri } : null}
      style={[styles.image, { width: size, height: size, backgroundColor: theme.surface2 }]}
      contentFit="cover"
      transition={160}
      accessible={false}
    />
  )
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.sm },
})
