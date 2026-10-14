const formatter = (() => {
  try {
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch (error) {
    // Un motor sin Intl completo no debe tumbar la pantalla: se cae al formato ISO.
    console.warn('Intl.DateTimeFormat no disponible', error)
    return null
  }
})()

export function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return formatter ? formatter.format(date).replace(/\./g, '') : iso.slice(0, 10)
}
