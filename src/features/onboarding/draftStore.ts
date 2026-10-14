import { useSyncExternalStore } from 'react'
import { registerSignOutTask } from '@/lib/session/SessionContext'
import { emptyDraft, type OnboardingDraft } from './lib/draft'

// Estado compartido entre los dos pasos (son rutas hermanas y el layout del grupo no es de este módulo).
// Vive solo en memoria: si la app se cierra, se rearma desde GET /me.
let draft: OnboardingDraft = emptyDraft
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDraft(): OnboardingDraft {
  return draft
}

export function setDraft(update: OnboardingDraft | ((current: OnboardingDraft) => OnboardingDraft)) {
  const next = typeof update === 'function' ? update(draft) : update
  if (next === draft) return
  draft = next
  emit()
}

export function updateDraft(patch: Partial<OnboardingDraft>) {
  setDraft((current) => ({ ...current, ...patch }))
}

export function resetDraft() {
  setDraft(emptyDraft)
}

export function useOnboardingDraft(): OnboardingDraft {
  return useSyncExternalStore(subscribe, getDraft, getDraft)
}

registerSignOutTask(() => resetDraft())
