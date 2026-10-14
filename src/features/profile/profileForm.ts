import type { Me, UpdateMeRequest } from '@/lib/api/types'
import {
  parseBirthDate,
  splitIsoDate,
  todayLocal,
  validateBio,
  validateCity,
  validateDisplayName,
  validateGenres,
  type BirthDateParts,
  type CalendarDate,
} from './validation'

export const CITY_OPTIONS = ['Bogotá', 'Medellín'] as const
export type CityOption = (typeof CITY_OPTIONS)[number]
export type CityChoice = CityOption | 'other'

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

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

// "bogota" o "MEDELLÍN" guardados a mano siguen cayendo en la opción correcta.
export function cityChoiceFor(city: string | null | undefined): { choice: CityChoice | null; other: string } {
  if (!city || !city.trim()) return { choice: null, other: '' }
  const known = CITY_OPTIONS.find((option) => fold(option) === fold(city))
  return known ? { choice: known, other: '' } : { choice: 'other', other: city.trim() }
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
  if (draft.cityChoice === 'other') return draft.otherCity.trim()
  return draft.cityChoice ?? ''
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
  today: CalendarDate = todayLocal(),
): { values: ProfileValues | null; errors: ProfileErrors } {
  const errors: ProfileErrors = {}
  const nameError = validateDisplayName(draft.displayName)
  if (nameError) errors.displayName = nameError

  const birth = parseBirthDate(draft.birth, today)
  if (!birth.ok) errors.birthDate = birth.error

  const city = resolveCity(draft)
  const cityError =
    draft.cityChoice === null
      ? 'Elige tu ciudad.'
      : draft.cityChoice === 'other' && !city
        ? 'Escribe el nombre de tu ciudad.'
        : validateCity(city)
  if (cityError) errors.city = cityError

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
