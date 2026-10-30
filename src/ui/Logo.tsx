import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useTheme } from './theme'

// El logo de la marca (Encorly-landing/src/assets/logo) partido en dos capas blancas para teñirlas por tema:
// la palabra va en el color del texto y la onda en el acento, que es lo que la distingue.
const letters = require('../../assets/brand/logo-letters.png')
const wave = require('../../assets/brand/logo-wave.png')
const RATIO = 1200 / 596

type LogoProps = { width: number }

export function Logo({ width }: LogoProps) {
  const theme = useTheme()
  const size = { width, height: width / RATIO }
  return (
    <View style={size} accessible accessibilityRole="image" accessibilityLabel="Encorely">
      <Image source={letters} style={StyleSheet.absoluteFill} tintColor={theme.text} contentFit="contain" />
      <Image source={wave} style={StyleSheet.absoluteFill} tintColor={theme.accentText} contentFit="contain" />
    </View>
  )
}
