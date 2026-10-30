import { useMemo } from 'react'
import Svg, { Path, Rect } from 'react-native-svg'
import { encodeQr } from './encoder'

type Props = {
  value: string
  size: number
  color: string
  background: string
  accessibilityLabel: string
}

// Zona de silencio de 4 módulos (ISO 18004): sin ella muchos escáneres no encuentran los buscadores.
const QUIET_ZONE = 4

export function QrSvg({ value, size, color, background, accessibilityLabel }: Props) {
  const { path, extent } = useMemo(() => {
    const qr = encodeQr(value)
    let d = ''
    qr.modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`
      }),
    )
    return { path: d, extent: qr.size + QUIET_ZONE * 2 }
  }, [value])

  // Módulos de un número entero de puntos: sin costuras de antialias entre módulos vecinos.
  const pixels = Math.max(1, Math.floor(size / extent)) * extent

  return (
    <Svg
      width={pixels}
      height={pixels}
      viewBox={`0 0 ${extent} ${extent}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Rect x={0} y={0} width={extent} height={extent} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  )
}
