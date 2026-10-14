import { ApiError, isApiError, userMessage } from '@/lib/api/errors'
import type { Me } from '@/lib/api/types'
import { MIN_AGE, parseIsoDate } from './birthDate'
import { cityChoiceFor, type CityChoice } from './city'
import { MAX_GENRES } from './genres'

export type StepOneField = 'displayName' | 'birthDate' | 'city'

export type OnboardingDraft = {
  ownerId: string | null
  // Ya se copiaron los datos de GET /me: no volver a pisar lo que la persona edite.
  profileApplied: boolean
  displayName: string
  day: string
  month: string
  year: string
  cityChoice: CityChoice | null
  otherCity: string
  genres: string[]
  // Errores del PATCH que pertenecen al paso 1 y se muestran allá al volver.
  stepOneErrors: Partial<Record<StepOneField, string>>
}

export const emptyDraft: OnboardingDraft = {
  ownerId: null,
  profileApplied: false,
  displayName: '',
  day: '',
  month: '',
  year: '',
  cityChoice: null,
  otherCity: '',
  genres: [],
  stepOneErrors: {},
}

// Un borrador de otra cuenta en el mismo teléfono nunca se hereda.
export function draftFor(draft: OnboardingDraft, ownerId: string, displayName: string): OnboardingDraft {
  if (draft.ownerId === ownerId) return draft
  return { ...emptyDraft, ownerId, displayName }
}

type Profile = Pick<Me, 'displayName' | 'birthDate' | 'city' | 'genres'>

// Prellena solo lo vacío: si la persona ya escribió algo mientras cargaba /me, gana lo suyo.
export function applyProfile(draft: OnboardingDraft, profile: Profile): OnboardingDraft {
  if (draft.profileApplied) return draft
  const next: OnboardingDraft = { ...draft, profileApplied: true }
  if (!next.displayName.trim() && profile.displayName) next.displayName = profile.displayName

  const birth = parseIsoDate(profile.birthDate)
  if (birth && !next.day && !next.month && !next.year) {
    next.day = String(birth.day).padStart(2, '0')
    next.month = String(birth.month).padStart(2, '0')
    next.year = String(birth.year)
  }

  if (!next.cityChoice) {
    const { choice, other } = cityChoiceFor(profile.city)
    next.cityChoice = choice
    next.otherCity = other
  }

  if (!next.genres.length && profile.genres?.length) next.genres = profile.genres.slice(0, MAX_GENRES)
  return next
}

export type SubmitErrors = {
  stepOne: Partial<Record<StepOneField, string>>
  genres: string | null
  general: string | null
}

export function onboardingSubmitErrors(error: unknown): SubmitErrors {
  const out: SubmitErrors = { stepOne: {}, genres: null, general: null }
  if (isApiError(error, 'under_age')) {
    out.stepOne.birthDate = `Encorely es solo para mayores de ${MIN_AGE} años.`
    return out
  }
  if (isApiError(error, 'unknown_genre')) {
    out.genres = 'Uno de los géneros ya no está disponible. Revisa tu selección.'
    return out
  }
  if (error instanceof ApiError && error.kind === 'http' && error.status === 400) {
    for (const field of ['displayName', 'birthDate', 'city'] as const) {
      const message = error.field(field)
      if (message) out.stepOne[field] = message
    }
    out.genres = error.field('genres')
    if (Object.keys(out.stepOne).length || out.genres) return out
  }
  out.general = userMessage(error)
  return out
}
