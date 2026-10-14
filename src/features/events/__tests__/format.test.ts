import { attendeesLabel, eventAccessibilityLabel, formatEventDate, lineupText } from '../format'
import { makeEvent } from '../__fixtures__/events'

describe('formatEventDate', () => {
  it('usa la hora de Bogotá aunque en UTC ya sea otro día', () => {
    const d = formatEventDate('2026-11-23T01:00:00Z')
    expect(d.day).toBe('22')
    expect(d.monthShort).toBe('NOV')
    expect(d.weekdayShort).toBe('DOM')
    expect(d.long).toBe('domingo 22 de noviembre')
    expect(d.time).toBe('8\u00A0p.\u00A0m.')
  })

  it('conserva los minutos cuando no son en punto y usa espacios normales', () => {
    const d = formatEventDate('2026-12-05T23:30:00Z')
    expect(d.time).toBe('6:30\u00A0p.\u00A0m.')
    expect(d.time).not.toMatch(/[\u202F\u2009]/)
    expect(d.long).toBe('sábado 5 de diciembre')
  })

  it('escribe la hora de la mañana como a. m.', () => {
    expect(formatEventDate('2027-01-10T14:00:00Z').time).toBe('9\u00A0a.\u00A0m.')
    expect(formatEventDate('2027-01-10T14:00:00Z').monthShort).toBe('ENE')
  })
})

describe('textos de la fila', () => {
  it('une el lineup y tolera texto suelto', () => {
    expect(lineupText(['Bomba Estéreo', 'Monsieur Periné'])).toBe('Bomba Estéreo · Monsieur Periné')
    expect(lineupText('Systema Solar')).toBe('Systema Solar')
    expect(lineupText(null)).toBe('')
  })

  it('no muestra asistentes si no hay', () => {
    expect(attendeesLabel(0)).toBeNull()
    expect(attendeesLabel(1)).toBe('1 va')
    expect(attendeesLabel(12)).toBe('12 van')
  })

  it('anuncia el concierto completo para lectores de pantalla', () => {
    const label = eventAccessibilityLabel(makeEvent({ iAmGoing: true, attendeeCount: 0 }))
    expect(label).toBe('Concierto Andrés Cepeda, domingo 22 de noviembre, 8\u00A0p.\u00A0m., Movistar Arena, Bogotá. Vas a ir.')
  })
})
