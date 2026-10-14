import { isDeleteConfirmation, validateGenres } from '../validation'

describe('validaciones del perfil', () => {
  it('géneros', () => {
    expect(validateGenres([])).toBe('Elige al menos un género.')
    expect(validateGenres(['rock'])).toBeNull()
    expect(validateGenres(Array.from({ length: 11 }, (_, i) => `g${i}`))).toMatch(/hasta 10/)
  })

  it('confirmación de borrado exige la palabra BORRAR', () => {
    expect(isDeleteConfirmation('BORRAR')).toBe(true)
    expect(isDeleteConfirmation(' borrar ')).toBe(true)
    expect(isDeleteConfirmation('BORRA')).toBe(false)
    expect(isDeleteConfirmation('')).toBe(false)
  })
})
