import type { Me } from '@/lib/api/types'
import { cityChoiceFor } from '@/features/shared/profileRules'
import { buildProfilePatch, draftFromMe, isDraftDirty, validateDraft, type ProfileDraft } from '../profileForm'

const today = { year: 2026, month: 10, day: 14 }

const me: Me = {
  id: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  birthDate: '1999-03-05',
  age: 27,
  city: 'Bogotá',
  genres: ['rock', 'indie'],
  bio: 'Voy a todo lo de Bomba Estéreo',
  onboardingCompleted: true,
  role: 'user',
  createdAt: '2026-01-01T00:00:00Z',
  acceptedConsentVersion: '2026-10-13',
  consentUpToDate: true,
  spotifyLinked: false,
  hasPassword: true,
}

const edit = (patch: Partial<ProfileDraft>): ProfileDraft => ({ ...draftFromMe(me), ...patch })

const patchFor = (draft: ProfileDraft) => {
  const { values, errors } = validateDraft(draft, today)
  if (!values) throw new Error(`draft inválido: ${JSON.stringify(errors)}`)
  return buildProfilePatch(me, values)
}

describe('draftFromMe', () => {
  it('separa la fecha y reconoce la ciudad', () => {
    expect(draftFromMe(me)).toEqual({
      displayName: 'Ana',
      birth: { day: '5', month: '3', year: '1999' },
      cityChoice: 'Bogotá',
      otherCity: '',
      genres: ['rock', 'indie'],
      bio: 'Voy a todo lo de Bomba Estéreo',
    })
  })

  it('reconoce ciudades sin tilde y deja el resto como "otra"', () => {
    expect(cityChoiceFor('medellin')).toEqual({ choice: 'Medellín', other: '' })
    expect(cityChoiceFor(' Cali ')).toEqual({ choice: 'other', other: 'Cali' })
    expect(cityChoiceFor(null)).toEqual({ choice: null, other: '' })
  })
})

describe('buildProfilePatch', () => {
  it('sin cambios devuelve un objeto vacío', () => {
    expect(patchFor(draftFromMe(me))).toEqual({})
  })

  it('manda solo los campos que cambiaron', () => {
    expect(patchFor(edit({ displayName: '  Ana María ' }))).toEqual({ displayName: 'Ana María' })
    expect(patchFor(edit({ birth: { day: '6', month: '3', year: '1999' } }))).toEqual({ birthDate: '1999-03-06' })
    expect(patchFor(edit({ cityChoice: 'other', otherCity: 'Cali' }))).toEqual({ city: 'Cali' })
  })

  it('los géneros se comparan como conjunto: reordenar no es un cambio', () => {
    expect(patchFor(edit({ genres: ['indie', 'rock'] }))).toEqual({})
    expect(patchFor(edit({ genres: ['rock'] }))).toEqual({ genres: ['rock'] })
  })

  it('vaciar la bio la manda como "" para que el back la borre', () => {
    expect(patchFor(edit({ bio: '   ' }))).toEqual({ bio: '' })
    expect(buildProfilePatch({ ...me, bio: null }, { ...validateDraft(edit({ bio: '' }), today).values!, bio: '' })).toEqual({})
  })
})

describe('isDraftDirty', () => {
  const initial = draftFromMe(me)

  it('no marca cambios por ceros a la izquierda, espacios ni orden de géneros', () => {
    expect(isDraftDirty(initial, edit({ birth: { day: '05', month: '03', year: '1999' } }))).toBe(false)
    expect(isDraftDirty(initial, edit({ displayName: 'Ana ' }))).toBe(false)
    expect(isDraftDirty(initial, edit({ genres: ['indie', 'rock'] }))).toBe(false)
  })

  it('detecta cambios reales en cualquier campo', () => {
    expect(isDraftDirty(initial, edit({ bio: '' }))).toBe(true)
    expect(isDraftDirty(initial, edit({ cityChoice: 'Medellín' }))).toBe(true)
    expect(isDraftDirty(initial, edit({ genres: ['rock', 'indie', 'salsa'] }))).toBe(true)
  })
})

describe('validateDraft', () => {
  it('junta los errores por campo', () => {
    const { values, errors } = validateDraft(
      edit({ displayName: '', birth: { day: '1', month: '1', year: '2015' }, cityChoice: null, genres: [], bio: 'x'.repeat(161) }),
      today,
    )
    expect(values).toBeNull()
    expect(Object.keys(errors).sort()).toEqual(['bio', 'birthDate', 'city', 'displayName', 'genres'])
  })

  it('"otra" ciudad exige escribirla', () => {
    expect(validateDraft(edit({ cityChoice: 'other', otherCity: '' }), today).errors.city).toBe('Escribe el nombre de tu ciudad.')
  })
})
