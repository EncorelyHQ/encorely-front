import {
  ageOn,
  BIO_MAX,
  charCount,
  cityChoiceFor,
  cityError,
  daysInMonth,
  formatIsoDate,
  isLeapYear,
  isValidDate,
  parseIsoDate,
  resolveCity,
  splitIsoDate,
  todayParts,
  validateBio,
  validateBirthDate,
  validateCity,
  validateDisplayName,
} from '../profileRules'

const today = { year: 2026, month: 10, day: 14 }
const birth = (day: string, month: string, year: string) => ({ day, month, year })

describe('calendario', () => {
  it('bisiestos', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
  })

  it('días por mes', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2025, 4)).toBe(30)
    expect(daysInMonth(2025, 12)).toBe(31)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('29 de febrero solo en bisiesto', () => {
    expect(isValidDate({ year: 2004, month: 2, day: 29 })).toBe(true)
    expect(isValidDate({ year: 2005, month: 2, day: 29 })).toBe(false)
    expect(isValidDate({ year: 2005, month: 4, day: 31 })).toBe(false)
    expect(isValidDate({ year: 2005, month: 13, day: 1 })).toBe(false)
    expect(isValidDate({ year: 2005, month: 1, day: 0 })).toBe(false)
  })
})

describe('formato yyyy-MM-dd', () => {
  it('rellena con ceros', () => {
    expect(formatIsoDate({ year: 2001, month: 3, day: 7 })).toBe('2001-03-07')
    expect(formatIsoDate({ year: 1999, month: 12, day: 31 })).toBe('1999-12-31')
  })

  it('ida y vuelta', () => {
    expect(parseIsoDate('2004-02-29')).toEqual({ year: 2004, month: 2, day: 29 })
    expect(parseIsoDate('2005-02-29')).toBeNull()
    expect(parseIsoDate('2004-2-9')).toBeNull()
    expect(parseIsoDate(null)).toBeNull()
  })

  it('hoy se toma del calendario local', () => {
    expect(todayParts(new Date(2026, 0, 5, 23, 59))).toEqual({ year: 2026, month: 1, day: 5 })
  })

  it('splitIsoDate separa sin ceros a la izquierda y tolera null', () => {
    expect(splitIsoDate('1999-03-05')).toEqual({ year: '1999', month: '3', day: '5' })
    expect(splitIsoDate(null)).toEqual({ year: '', month: '', day: '' })
    expect(splitIsoDate('basura')).toEqual({ year: '', month: '', day: '' })
  })
})

describe('edad', () => {
  it('cuenta el cumpleaños de este año', () => {
    expect(ageOn({ year: 2000, month: 10, day: 14 }, today)).toBe(26)
    expect(ageOn({ year: 2000, month: 10, day: 15 }, today)).toBe(25)
  })

  it('29 de febrero cumple el 1 de marzo en año no bisiesto (igual que el back)', () => {
    const born = { year: 2008, month: 2, day: 29 }
    expect(ageOn(born, { year: 2026, month: 2, day: 28 })).toBe(17)
    expect(ageOn(born, { year: 2026, month: 3, day: 1 })).toBe(18)
    expect(ageOn(born, { year: 2028, month: 2, day: 29 })).toBe(20)
  })
})

describe('validateBirthDate', () => {
  it('acepta una fecha válida de alguien mayor de edad y la devuelve en ISO', () => {
    expect(validateBirthDate(birth('5', '3', '1999'), today)).toEqual({ ok: true, iso: '1999-03-05', age: 27 })
  })

  it('exactamente 18 hoy pasa y 18 mañana no', () => {
    expect(validateBirthDate(birth('14', '10', '2008'), today)).toEqual({ ok: true, iso: '2008-10-14', age: 18 })
    expect(validateBirthDate(birth('15', '10', '2008'), today)).toEqual({
      ok: false,
      reason: 'underage',
      message: 'Necesitas tener 18 años o más para usar Encorely.',
    })
  })

  it('acepta un solo dígito en día y mes', () => {
    expect(validateBirthDate(birth('7', '3', '2001'), today)).toEqual({ ok: true, iso: '2001-03-07', age: 25 })
  })

  it('pide la fecha cuando está vacía y la completa cuando falta una parte', () => {
    expect(validateBirthDate(birth('', '', ''), today)).toEqual({ ok: false, reason: 'empty', message: 'Escribe tu fecha de nacimiento.' })
    expect(validateBirthDate(birth('1', '', '1990'), today)).toEqual({ ok: false, reason: 'incomplete', message: 'Completa el día, el mes y el año.' })
    expect(validateBirthDate(birth('', '10', '2000'), today)).toMatchObject({ ok: false, reason: 'incomplete' })
  })

  it('rechaza caracteres que no son números y años de menos de cuatro cifras', () => {
    expect(validateBirthDate(birth('1a', '2', '1990'), today)).toMatchObject({ ok: false, reason: 'not_numeric' })
    expect(validateBirthDate(birth('1a', '10', '2000'), today)).toMatchObject({ ok: false, reason: 'not_numeric' })
    expect(validateBirthDate(birth('1', '2', '90'), today)).toEqual({ ok: false, reason: 'year_length', message: 'Escribe el año con cuatro cifras.' })
    expect(validateBirthDate(birth('1', '10', '99'), today)).toMatchObject({ ok: false, reason: 'year_length' })
  })

  it('valida meses y días reales, incluidos los bisiestos', () => {
    expect(validateBirthDate(birth('1', '13', '1990'), today)).toEqual({ ok: false, reason: 'month', message: 'El mes va de 1 a 12.' })
    expect(validateBirthDate(birth('10', '00', '2000'), today)).toMatchObject({ ok: false, reason: 'month' })
    expect(validateBirthDate(birth('31', '4', '1990'), today)).toEqual({ ok: false, reason: 'day', message: 'Ese mes tiene 30 días. Revisa el día.' })
    expect(validateBirthDate(birth('31', '04', '2000'), today)).toMatchObject({ ok: false, reason: 'day' })
    expect(validateBirthDate(birth('29', '2', '1999'), today)).toMatchObject({ ok: false, reason: 'day' })
    expect(validateBirthDate(birth('29', '02', '2005'), today)).toMatchObject({ ok: false, reason: 'day' })
    expect(validateBirthDate(birth('29', '2', '2000'), today)).toMatchObject({ ok: true, iso: '2000-02-29' })
    expect(validateBirthDate(birth('29', '02', '2004'), today)).toMatchObject({ ok: true, iso: '2004-02-29' })
    expect(validateBirthDate(birth('0', '1', '1990'), today)).toMatchObject({ ok: false, reason: 'day' })
  })

  it('nacido 29-feb cumple 18 el 1 de marzo', () => {
    expect(validateBirthDate(birth('29', '2', '2008'), { year: 2026, month: 2, day: 28 })).toMatchObject({ ok: false, reason: 'underage' })
    expect(validateBirthDate(birth('29', '2', '2008'), { year: 2026, month: 3, day: 1 })).toMatchObject({ ok: true, age: 18 })
  })

  it('rechaza fechas futuras y edades imposibles', () => {
    expect(validateBirthDate(birth('1', '1', '2030'), today)).toEqual({ ok: false, reason: 'future', message: 'Esa fecha todavía no ha llegado. Revísala.' })
    expect(validateBirthDate(birth('15', '10', '2026'), today)).toMatchObject({ ok: false, reason: 'future' })
    expect(validateBirthDate(birth('1', '1', '1890'), today)).toEqual({ ok: false, reason: 'implausible', message: 'Revisa el año: parece que tiene un error.' })
  })
})

describe('validaciones de texto', () => {
  it('nombre entre 2 y 50 caracteres, ignorando espacios de los bordes', () => {
    expect(validateDisplayName('  ')).toBe('Escribe tu nombre.')
    expect(validateDisplayName(' A ')).toBe('Tu nombre necesita al menos 2 letras.')
    expect(validateDisplayName('Ana')).toBeNull()
    expect(validateDisplayName('Al')).toBeNull()
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

  it('ciudad', () => {
    expect(validateCity('')).toBe('Elige tu ciudad.')
    expect(validateCity('B')).toMatch(/nombre completo/)
    expect(validateCity('Cali')).toBeNull()
    expect(validateCity('a'.repeat(81))).toMatch(/hasta 80/)
  })
})

describe('ciudad como opción', () => {
  it('reconoce ciudades sin tilde, con sufijo y deja el resto como "otra"', () => {
    expect(cityChoiceFor('medellin')).toEqual({ choice: 'Medellín', other: '' })
    expect(cityChoiceFor('Bogotá D.C.')).toEqual({ choice: 'Bogotá', other: '' })
    expect(cityChoiceFor(' Cali ')).toEqual({ choice: 'other', other: 'Cali' })
    expect(cityChoiceFor(null)).toEqual({ choice: null, other: '' })
  })

  it('resuelve el texto final y valida la elección', () => {
    expect(resolveCity(null, '')).toBeNull()
    expect(resolveCity('Bogotá', 'x')).toBe('Bogotá')
    expect(resolveCity('other', '  Santa   Marta ')).toBe('Santa Marta')
    expect(cityError(null, '')).toBe('Elige tu ciudad.')
    expect(cityError('Medellín', '')).toBeNull()
    expect(cityError('other', ' ')).toBe('Escribe el nombre de tu ciudad.')
    expect(cityError('other', 'B')).toMatch(/nombre completo/)
    expect(cityError('other', 'Cali')).toBeNull()
  })
})
