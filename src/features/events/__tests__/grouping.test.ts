import { cityOptions, defaultCity, groupEvents } from '../grouping'
import { makeEvent } from '../__fixtures__/events'

describe('groupEvents', () => {
  it('pone "Vas a ir" arriba y ordena cada sección por fecha', () => {
    const events = [
      makeEvent({ id: 'late', startsAt: '2026-12-20T01:00:00Z' }),
      makeEvent({ id: 'goingLate', startsAt: '2026-12-01T01:00:00Z', iAmGoing: true }),
      makeEvent({ id: 'early', startsAt: '2026-11-01T01:00:00Z' }),
      makeEvent({ id: 'goingEarly', startsAt: '2026-10-20T01:00:00Z', iAmGoing: true }),
    ]
    const sections = groupEvents(events)
    expect(sections.map((s) => s.title)).toEqual(['Vas a ir', 'Próximos'])
    expect(sections[0].data.map((e) => e.id)).toEqual(['goingEarly', 'goingLate'])
    expect(sections[1].data.map((e) => e.id)).toEqual(['early', 'late'])
  })

  it('omite secciones vacías', () => {
    expect(groupEvents([makeEvent()]).map((s) => s.key)).toEqual(['upcoming'])
    expect(groupEvents([])).toEqual([])
  })

  it('no muta la lista original', () => {
    const events = [makeEvent({ id: 'b', startsAt: '2026-12-01T00:00:00Z' }), makeEvent({ id: 'a', startsAt: '2026-11-01T00:00:00Z' })]
    groupEvents(events)
    expect(events.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('filtro de ciudad', () => {
  it('elige la ciudad del usuario aunque venga sin tilde', () => {
    expect(defaultCity('bogota')).toBe('Bogotá')
    expect(defaultCity(null)).toBeUndefined()
  })

  it('suma la ciudad del usuario si no está en los chips', () => {
    expect(cityOptions('Cali')).toEqual(['Bogotá', 'Medellín', 'Cali'])
    expect(cityOptions('Medellin')).toEqual(['Bogotá', 'Medellín'])
    expect(defaultCity('Cali')).toBe('Cali')
  })
})
