import { useSyncExternalStore } from 'react'

// Señal en memoria (nunca en disco): "el servidor pidió re-consentimiento para este usuario".
// Va atada al userId para que un cambio de cuenta en el mismo teléfono no herede el bloqueo.
let flaggedUserId: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function flagConsentRequired(userId: string) {
  if (flaggedUserId === userId) return
  flaggedUserId = userId
  emit()
}

export function clearConsentFlag() {
  if (flaggedUserId === null) return
  flaggedUserId = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useConsentFlag(userId: string | null | undefined): boolean {
  const flagged = useSyncExternalStore(subscribe, () => flaggedUserId)
  return !!userId && flagged === userId
}
