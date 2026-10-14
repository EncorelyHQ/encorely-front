import { ApiError } from '@/lib/api/errors'
import { cityChoiceFor, cityError, resolveCity } from '@/features/shared/profileRules'
import { applyProfile, draftFor, emptyDraft, onboardingSubmitErrors } from '../draft'
import { knownGenres, MAX_GENRES, toggleGenre } from '../genres'

describe('ciudad', () => {
  it('reconoce las opciones aunque vengan sin tilde o con sufijo', () => {
    expect(cityChoiceFor('bogota')).toEqual({ choice: 'Bogotá', other: '' })
    expect(cityChoiceFor('Bogotá D.C.')).toEqual({ choice: 'Bogotá', other: '' })
    expect(cityChoiceFor('MEDELLIN')).toEqual({ choice: 'Medellín', other: '' })
    expect(cityChoiceFor('Cali')).toEqual({ choice: 'other', other: 'Cali' })
    expect(cityChoiceFor(null)).toEqual({ choice: null, other: '' })
  })

  it('resuelve y valida "Otra"', () => {
    expect(resolveCity('other', '  Santa   Marta ')).toBe('Santa Marta')
    expect(resolveCity('Medellín', 'ignorado')).toBe('Medellín')
    expect(cityError(null, '')).not.toBeNull()
    expect(cityError('other', ' ')).not.toBeNull()
    expect(cityError('other', 'X')).not.toBeNull()
    expect(cityError('other', 'Cali')).toBeNull()
  })
})

describe('géneros', () => {
  it('agrega, quita y respeta el máximo', () => {
    expect(toggleGenre([], 'rock')).toEqual(['rock'])
    expect(toggleGenre(['rock'], 'rock')).toEqual([])
    const full = Array.from({ length: MAX_GENRES }, (_, i) => `g${i}`)
    expect(toggleGenre(full, 'nuevo')).toEqual(full)
  })

  it('descarta slugs que ya no existen', () => {
    const catalog = [
      { id: 1, slug: 'rock', name: 'Rock' },
      { id: 2, slug: 'salsa', name: 'Salsa' },
    ]
    expect(knownGenres(['rock', 'vaporwave', 'salsa'], catalog)).toEqual(['rock', 'salsa'])
  })
})

describe('borrador', () => {
  it('no hereda el borrador de otra cuenta', () => {
    const mine = { ...emptyDraft, ownerId: 'a', displayName: 'Ana', genres: ['rock'] }
    expect(draftFor(mine, 'a', 'Ana')).toBe(mine)
    expect(draftFor(mine, 'b', 'Beto')).toEqual({ ...emptyDraft, ownerId: 'b', displayName: 'Beto' })
  })

  it('prellena desde /me solo lo vacío y una sola vez', () => {
    const draft = { ...emptyDraft, ownerId: 'a', displayName: 'Ana editado' }
    const profile = { displayName: 'Ana', birthDate: '2001-03-07', city: 'Cali', genres: ['rock'] }
    const next = applyProfile(draft, profile)
    expect(next).toMatchObject({
      displayName: 'Ana editado',
      day: '07',
      month: '03',
      year: '2001',
      cityChoice: 'other',
      otherCity: 'Cali',
      genres: ['rock'],
      profileApplied: true,
    })
    expect(applyProfile({ ...next, genres: [] }, { ...profile, genres: ['salsa'] }).genres).toEqual([])
  })

  it('perfil vacío deja el borrador vacío', () => {
    const next = applyProfile({ ...emptyDraft, ownerId: 'a' }, { displayName: '', birthDate: null, city: null, genres: [] })
    expect(next).toMatchObject({ day: '', cityChoice: null, genres: [] })
  })
})

describe('errores del PATCH /me', () => {
  const http = (status: number, code?: string, errors?: Record<string, string[]>) =>
    ApiError.fromProblem(status, { status, code, errors })

  it('under_age vuelve al paso 1', () => {
    expect(onboardingSubmitErrors(http(400, 'under_age')).stepOne.birthDate).toMatch(/18/)
  })

  it('reparte errores por campo', () => {
    const result = onboardingSubmitErrors(http(400, 'validation_failed', { City: ['Muy corta'], Genres: ['Elige al menos un género.'] }))
    expect(result).toEqual({ stepOne: { city: 'Muy corta' }, genres: 'Elige al menos un género.', general: null })
  })

  it('cualquier otro error es general', () => {
    expect(onboardingSubmitErrors(http(500)).general).toMatch(/servidor/)
  })
})
