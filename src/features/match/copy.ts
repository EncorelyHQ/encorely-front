// Solo dice lo que el back confirmó: sin evento ni géneros, no se inventa un motivo.
export function matchReason(eventName: string | null | undefined, genres: string): string {
  const event = eventName?.trim()
  if (event && genres) return `Los dos van a ${event} y les gusta ${genres}.`
  if (event) return `Los dos van a ${event}.`
  if (genres) return `A los dos les gusta ${genres}.`
  return 'Ya pueden escribirse.'
}
