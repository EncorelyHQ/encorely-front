import {
  bogotaLabel,
  bogotaToIso,
  isoToBogota,
  maskDateInput,
  maskTimeInput,
  parseDateInput,
  parseTimeInput,
} from '../model/datetime'

describe('hora de Bogotá → ISO UTC', () => {
  it('suma 5 horas y pasa al día siguiente en UTC cuando toca', () => {
    expect(bogotaToIso('22/11/2026', '20:00')).toBe('2026-11-23T01:00:00.000Z')
  })

  it('medianoche en Bogotá son las 5 a. m. UTC del mismo día', () => {
    expect(bogotaToIso('01/01/2027', '00:00')).toBe('2027-01-01T05:00:00.000Z')
  })

  it('las 7 p. m. del 31 de diciembre ya son año nuevo en UTC', () => {
    expect(bogotaToIso('31/12/2026', '19:00')).toBe('2027-01-01T00:00:00.000Z')
  })

  it('las 11:59 p. m. cruzan el día y conservan los minutos', () => {
    expect(bogotaToIso('28/02/2027', '23:59')).toBe('2027-03-01T04:59:00.000Z')
  })

  it('devuelve null si la fecha o la hora no son válidas', () => {
    expect(bogotaToIso('31/02/2027', '20:00')).toBeNull()
    expect(bogotaToIso('22/11/2026', '24:00')).toBeNull()
    expect(bogotaToIso('', '')).toBeNull()
  })
})

describe('ISO UTC → hora de Bogotá', () => {
  it('resta 5 horas y vuelve al día anterior si hace falta', () => {
    expect(isoToBogota('2026-11-23T01:00:00Z')).toEqual({ date: '22/11/2026', time: '20:00' })
    expect(isoToBogota('2027-01-01T04:59:00Z')).toEqual({ date: '31/12/2026', time: '23:59' })
  })

  it('las 5 a. m. UTC son la medianoche de Bogotá', () => {
    expect(isoToBogota('2027-01-01T05:00:00.000Z')).toEqual({ date: '01/01/2027', time: '00:00' })
  })

  it('respeta ISO con offset explícito', () => {
    expect(isoToBogota('2026-11-22T20:00:00-05:00')).toEqual({ date: '22/11/2026', time: '20:00' })
  })

  it('ida y vuelta da lo mismo', () => {
    for (const [date, time] of [
      ['01/01/2027', '00:00'],
      ['15/06/2027', '12:30'],
      ['29/02/2028', '23:45'],
    ]) {
      const iso = bogotaToIso(date, time)
      expect(iso).not.toBeNull()
      expect(isoToBogota(iso!)).toEqual({ date, time })
    }
  })

  it('null con un ISO inválido y etiqueta vacía', () => {
    expect(isoToBogota('no es fecha')).toBeNull()
    expect(bogotaLabel('no es fecha')).toBe('')
    expect(bogotaLabel('2026-11-23T01:00:00Z')).toBe('22/11/2026 20:00')
  })
})

describe('validación de partes', () => {
  it('distingue vacío, formato y fecha inexistente', () => {
    expect(parseDateInput('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseDateInput('2026-11-22')).toEqual({ ok: false, reason: 'format' })
    expect(parseDateInput('1/11/2026')).toEqual({ ok: false, reason: 'format' })
    expect(parseDateInput('31/04/2027')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseDateInput('10/13/2027')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseDateInput('00/10/2027')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('29 de febrero solo en bisiesto', () => {
    expect(parseDateInput('29/02/2028').ok).toBe(true)
    expect(parseDateInput('29/02/2027')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('hora de 00:00 a 23:59', () => {
    expect(parseTimeInput('00:00')).toEqual({ ok: true, value: { hour: 0, minute: 0 } })
    expect(parseTimeInput('23:59')).toEqual({ ok: true, value: { hour: 23, minute: 59 } })
    expect(parseTimeInput('24:00')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseTimeInput('12:60')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseTimeInput('8:00')).toEqual({ ok: false, reason: 'format' })
    expect(parseTimeInput(' ')).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('máscaras', () => {
  it('pone las barras de la fecha mientras se escribe', () => {
    expect(maskDateInput('2')).toBe('2')
    expect(maskDateInput('221')).toBe('22/1')
    expect(maskDateInput('22112026')).toBe('22/11/2026')
    expect(maskDateInput('22/11/20269')).toBe('22/11/2026')
    expect(maskDateInput('22-11-2026')).toBe('22/11/2026')
  })

  it('pone los dos puntos de la hora', () => {
    expect(maskTimeInput('20')).toBe('20')
    expect(maskTimeInput('203')).toBe('20:3')
    expect(maskTimeInput('20:305')).toBe('20:30')
  })
})
