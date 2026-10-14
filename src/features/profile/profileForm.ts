import type { Me, UpdateMeRequest } from '@/lib/api/types'
import {
  cityChoiceFor,
  cityError,
  resolveCity as resolveCityChoice,
  splitIsoDate,
  todayParts,
  validateBio,
  validateBirthDate,
  validateDisplayName,
  type BirthDateParts,
  type CalendarDate,
  type CityChoice,
} from '@/features/shared/profileRules'
import { validateGenres } from './validation'

export type ProfileDraft = {
  displayName: string
  birth: BirthDateParts
  cityChoice: CityChoice | null
  otherCity: string
  genres: string[]
  bio: string
}

export type ProfileField = 'displayName' | 'birthDate' | 'city' | 'genres' | 'bio'
export type ProfileErrors = Partial<Record<ProfileField, string>>

export type ProfileValues = {
  displayName: string
  birthDate: string
  city: string
  genres: string[]
  bio: string
}

export function draftFromMe(me: Me): ProfileDraft {
  const { choice, other } = cityChoiceFor(me.city)
  return {
    displayName: me.displayName,
    birth: splitIsoDate(me.birthDate),
    cityChoice: choice,
    otherCity: other,
    genres: [...me.genres],
    bio: me.bio ?? '',
  }
}

export function resolveCity(draft: Pick<ProfileDraft, 'cityChoice' | 'otherCity'>): string {
  return resolveCityChoice(draft.cityChoice, draft.otherCity) ?? ''
}

const sameSet = (a: readonly string[], b: readonly string[]) => {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((item) => set.has(item))
}

// "05" y "5" son el mismo día: la comparación es por valor, no por texto.
const birthKey = (parts: BirthDateParts) =>
  [parts.day, parts.month, parts.year].map((p) => (/^\d+$/.test(p.trim()) ? String(Number(p)) : p.trim())).join('-')

export function isDraftDirty(initial: ProfileDraft, draft: ProfileDraft): boolean {
  return (
    initial.displayName.trim() !== draft.displayName.trim() ||
    birthKey(initial.birth) !== birthKey(draft.birth) ||
    resolveCity(initial) !== resolveCity(draft) ||
    !sameSet(initial.genres, draft.genres) ||
    initial.bio.trim() !== draft.bio.trim()
  )
}

export function validateDraft(
  draft: ProfileDraft,
  today: CalendarDate = todayParts(),
): { values: ProfileValues | null; errors: ProfileErrors } {
  const errors: ProfileErrors = {}
  const nameError = validateDisplayName(draft.displayName)
  if (nameError) errors.displayName = nameError

  const birth = validateBirthDate(draft.birth, today)
  if (!birth.ok) errors.birthDate = birth.message

  const city = resolveCity(draft)
  const cityMessage = cityError(draft.cityChoice, draft.otherCity)
  if (cityMessage) errors.city = cityMessage

  const genresError = validateGenres(draft.genres)
  if (genresError) errors.genres = genresError

  const bioError = validateBio(draft.bio)
  if (bioError) errors.bio = bioError

  if (Object.keys(errors).length > 0 || !birth.ok) return { values: null, errors }
  return {
    values: {
      displayName: draft.displayName.trim(),
      birthDate: birth.iso,
      city,
      genres: [...draft.genres],
      bio: draft.bio.trim(),
    },
    errors,
  }
}

// PATCH solo con lo que cambió: el back trata null como "no tocar" y la bio "" como "borrarla".
export function buildProfilePatch(me: Me, values: ProfileValues): UpdateMeRequest {
  const patch: UpdateMeRequest = {}
  if (values.displayName !== me.displayName) patch.displayName = values.displayName
  if (values.birthDate !== (me.birthDate ?? '').slice(0, 10)) patch.birthDate = values.birthDate
  if (values.city !== (me.city ?? '')) patch.city = values.city
  if (!sameSet(values.genres, me.genres)) patch.genres = values.genres
  if (values.bio !== (me.bio ?? '').trim()) patch.bio = values.bio
  return patch
}
