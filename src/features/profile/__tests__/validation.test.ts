import {
  ageOn,
  BIO_MAX,
  charCount,
  daysInMonth,
  isDeleteConfirmation,
  parseBirthDate,
  splitIsoDate,
  validateBio,
  validateCity,
  validateDisplayName,
  validateGenres,
} from '../validation'

const today = { year: 2026, month: 10, day: 14 }

describe('parseBirthDate', () => {
  it('acepta una fecha válida de alguien mayor de edad y la devuelve en ISO', () => {
    expect(parseBirthDate({ day: '5', month: '3', year: '1999' }, today)).toEqual({ ok: true, iso: '1999-03-05', age: 27 })
  })

  it('acepta a quien cumple 18 hoy y rechaza a quien los cumple mañana', () => {
    expect(parseBirthDate({ day: '14', month: '10', year: '2008' }, today)).toMatchObject({ ok: true, age: 18 })
    const tomorrow = parseBirthDate({ day: '15', month: '10', year: '2008' }, today)
    expect(tomorrow).toEqual({ ok: false, error: 'Necesitas tener 18 años o más para usar Encorely.' })
  })

  it('pide la fecha cuando está vacía y la completa cuando falta una parte', () => {
    expect(parseBirthDate({ day: '', month: '', year: '' }, today)).toEqual({ ok: false, error: 'Escribe tu fecha de nacimiento.' })
    expect(parseBirthDate({ day: '1', month: '', year: '1990' }, today)).toEqual({ ok: false, error: 'Completa el día, el mes y el año.' })
  })

  it('rechaza caracteres que no son números y años de menos de cuatro cifras', () => {
    expect(parseBirthDate({ day: '1a', month: '2', year: '1990' }, today)).toMatchObject({ ok: false })
    expect(parseBirthDate({ day: '1', month: '2', year: '90' }, today)).toEqual({ ok: false, error: 'Escribe el año con cuatro cifras.' })
  })

  it('valida meses y días reales, incluidos los bisiestos', () => {
    expect(parseBirthDate({ day: '1', month: '13', year: '1990' }, today)).toEqual({ ok: false, error: 'El mes va de 1 a 12.' })
    expect(parseBirthDate({ day: '31', month: '4', year: '1990' }, today)).toEqual({ ok: false, error: 'Ese mes tiene 30 días. Revisa el día.' })
    expect(parseBirthDate({ day: '29', month: '2', year: '1999' }, today)).toMatchObject({ ok: false })
    expect(parseBirthDate({ day: '29', month: '2', year: '2000' }, today)).toMatchObject({ ok: true, iso: '2000-02-29' })
    expect(parseBirthDate({ day: '0', month: '1', year: '1990' }, today)).toMatchObject({ ok: false })
  })

  it('rechaza fechas futuras y edades imposibles', () => {
    expect(parseBirthDate({ day: '1', month: '1', year: '2030' }, today)).toEqual({ ok: false, error: 'Esa fecha todavía no ha llegado. Revísala.' })
    expect(parseBirthDate({ day: '1', month: '1', year: '1890' }, today)).toEqual({ ok: false, error: 'Revisa el año: parece que tiene un error.' })
  })
})

describe('ageOn', () => {
  it('no suma el año hasta el día del cumpleaños', () => {
    expect(ageOn({ year: 2000, month: 10, day: 15 }, today)).toBe(25)
    expect(ageOn({ year: 2000, month: 10, day: 14 }, today)).toBe(26)
  })

  it('quien nació un 29 de febrero cumple el 1 de marzo en años no bisiestos, como en el back', () => {
    const birth = { year: 2008, month: 2, day: 29 }
    expect(ageOn(birth, { year: 2026, month: 2, day: 28 })).toBe(17)
    expect(ageOn(birth, { year: 2026, month: 3, day: 1 })).toBe(18)
  })
})

describe('utilidades de fecha', () => {
  it('daysInMonth respeta bisiestos', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('splitIsoDate separa sin ceros a la izquierda y tolera null', () => {
    expect(splitIsoDate('1999-03-05')).toEqual({ year: '1999', month: '3', day: '5' })
    expect(splitIsoDate(null)).toEqual({ year: '', month: '', day: '' })
    expect(splitIsoDate('basura')).toEqual({ year: '', month: '', day: '' })
  })
})

describe('validaciones de texto', () => {
  it('nombre entre 2 y 50 caracteres, ignorando espacios de los bordes', () => {
    expect(validateDisplayName('  ')).toBe('Escribe tu nombre.')
    expect(validateDisplayName(' A ')).toBe('Tu nombre necesita al menos 2 letras.')
    expect(validateDisplayName('Ana')).toBeNull()
    expect(validateDisplayName('a'.repeat(51))).toMatch(/hasta 50/)
  })

  it('bio opcional de hasta 160 caracteres visibles', () => {
    expect(validateBio('')).toBeNull()
    expect(validateBio('a'.repeat(BIO_MAX))).toBeNull()
    expect(validateBio('a'.repeat(BIO_MAX + 1))).toBe('Puedes escribir hasta 160 caracteres.')
    // Un emoji cuenta como un carácter aunque ocupe dos unidades UTF-16.
    expect(charCount('🎸'.repeat(BIO_MAX))).toBe(BIO_MAX)
    expect(validateBio('🎸'.repeat(BIO_MAX))).toBeNull()
  })

  it('ciudad y géneros', () => {
    expect(validateCity('')).toBe('Elige tu ciudad.')
    expect(validateCity('B')).toMatch(/nombre completo/)
    expect(validateCity('Cali')).toBeNull()
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
