import {
  ageOn,
  birthDateMessage,
  daysInMonth,
  formatIsoDate,
  isLeapYear,
  isValidDate,
  parseIsoDate,
  todayParts,
  validateBirthDate,
} from '../birthDate'

const today = { year: 2026, month: 10, day: 14 }

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
    expect(daysInMonth(2025, 4)).toBe(30)
    expect(daysInMonth(2025, 12)).toBe(31)
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
})

describe('edad', () => {
  it('cuenta el cumpleaños de este año', () => {
    expect(ageOn({ year: 2000, month: 10, day: 14 }, today)).toBe(26)
    expect(ageOn({ year: 2000, month: 10, day: 15 }, today)).toBe(25)
  })

  it('29 de febrero cumple el 1 de marzo en año no bisiesto (igual que el back)', () => {
    const birth = { year: 2008, month: 2, day: 29 }
    expect(ageOn(birth, { year: 2026, month: 2, day: 28 })).toBe(17)
    expect(ageOn(birth, { year: 2026, month: 3, day: 1 })).toBe(18)
    expect(ageOn(birth, { year: 2028, month: 2, day: 29 })).toBe(20)
  })
})

describe('validateBirthDate', () => {
  it('exactamente 18 hoy pasa', () => {
    expect(validateBirthDate('14', '10', '2008', today)).toEqual({ ok: true, iso: '2008-10-14', age: 18 })
  })

  it('18 mañana no pasa', () => {
    expect(validateBirthDate('15', '10', '2008', today)).toEqual({ ok: false, reason: 'underage' })
  })

  it('acepta un solo dígito en día y mes', () => {
    expect(validateBirthDate('7', '3', '2001', today)).toEqual({ ok: true, iso: '2001-03-07', age: 25 })
  })

  it('29 de febrero válido en bisiesto e inválido si no', () => {
    expect(validateBirthDate('29', '02', '2004', today)).toMatchObject({ ok: true, iso: '2004-02-29' })
    expect(validateBirthDate('29', '02', '2005', today)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('nacido 29-feb cumple 18 el 1 de marzo', () => {
    expect(validateBirthDate('29', '2', '2008', { year: 2026, month: 2, day: 28 })).toEqual({ ok: false, reason: 'underage' })
    expect(validateBirthDate('29', '2', '2008', { year: 2026, month: 3, day: 1 })).toMatchObject({ ok: true, age: 18 })
  })

  it('fecha futura', () => {
    expect(validateBirthDate('15', '10', '2026', today)).toEqual({ ok: false, reason: 'future' })
    expect(validateBirthDate('1', '1', '2030', today)).toEqual({ ok: false, reason: 'future' })
  })

  it('incompleta o año de 2 cifras', () => {
    expect(validateBirthDate('', '10', '2000', today)).toEqual({ ok: false, reason: 'incomplete' })
    expect(validateBirthDate('1', '10', '99', today)).toEqual({ ok: false, reason: 'incomplete' })
  })

  it('caracteres no numéricos o fuera de rango', () => {
    expect(validateBirthDate('1a', '10', '2000', today)).toEqual({ ok: false, reason: 'invalid' })
    expect(validateBirthDate('31', '04', '2000', today)).toEqual({ ok: false, reason: 'invalid' })
    expect(validateBirthDate('10', '00', '2000', today)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('año implausible', () => {
    expect(validateBirthDate('1', '1', '1890', today)).toEqual({ ok: false, reason: 'implausible' })
  })

  it('cada motivo tiene un mensaje accionable', () => {
    for (const reason of ['incomplete', 'invalid', 'future', 'underage', 'implausible'] as const) {
      expect(birthDateMessage(reason).length).toBeGreaterThan(10)
    }
  })
})
