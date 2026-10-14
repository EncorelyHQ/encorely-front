import { ApiError } from '@/lib/api/errors'
import {
  emptyEventForm,
  eventToForm,
  hasErrors,
  serverEventErrors,
  toEventRequest,
  validateEventForm,
  type EventFormValues,
} from '../model/eventForm'
import type { AdminEvent } from '../types'

const NOW = new Date('2026-10-14T15:00:00Z')

const valid = (over: Partial<EventFormValues> = {}): EventFormValues => ({
  ...emptyEventForm(),
  name: 'Bomba Estéreo en vivo',
  lineup: ['Bomba Estéreo', '  Monsieur Periné '],
  venue: 'Movistar Arena',
  cityChoice: 'Bogotá',
  date: '22/11/2026',
  time: '20:00',
  ...over,
})

const create = { now: NOW, requireFuture: true }
const edit = { now: NOW, requireFuture: false }

describe('validateEventForm', () => {
  it('un formulario completo no tiene errores', () => {
    expect(validateEventForm(valid(), create)).toEqual({})
  })

  it('el formulario vacío pide cada campo obligatorio', () => {
    const errors = validateEventForm(emptyEventForm(), create)
    expect(Object.keys(errors).sort()).toEqual(['date', 'lineup', 'name', 'time', 'venue'])
    expect(errors.lineup).toBe('Agrega al menos un artista.')
  })

  it('nombre corto y lugar corto', () => {
    const errors = validateEventForm(valid({ name: 'Ab', venue: 'X' }), create)
    expect(errors.name).toMatch(/entre 3 y 200/)
    expect(errors.venue).toMatch(/entre 2 y 200/)
  })

  it('lineup: ignora campos vacíos, detecta repetidos sin importar tildes ni mayúsculas', () => {
    expect(validateEventForm(valid({ lineup: ['', '  '] }), create).lineup).toBe('Agrega al menos un artista.')
    expect(validateEventForm(valid({ lineup: ['Bomba Estéreo', '', 'bomba estereo'] }), create).lineup).toMatch(/repetidos/)
    expect(validateEventForm(valid({ lineup: Array.from({ length: 31 }, (_, i) => `A${i}`) }), create).lineup).toMatch(/30/)
  })

  it('ciudad "otra" exige escribirla', () => {
    expect(validateEventForm(valid({ cityChoice: 'other', otherCity: '' }), create).city).toBe('Escribe la ciudad.')
    expect(validateEventForm(valid({ cityChoice: 'other', otherCity: 'Cali' }), create).city).toBeUndefined()
  })

  it('fecha y hora: formato, fecha inexistente y hora fuera de rango', () => {
    expect(validateEventForm(valid({ date: '2026-11-22' }), create).date).toBe('Usa el formato DD/MM/AAAA.')
    expect(validateEventForm(valid({ date: '31/11/2026' }), create).date).toMatch(/no existe/)
    expect(validateEventForm(valid({ time: '25:00' }), create).time).toMatch(/00:00 a 23:59/)
  })

  it('al crear no deja una fecha que ya pasó (comparando en hora de Bogotá)', () => {
    // NOW = 10:00 en Bogotá del 14/10/2026.
    expect(validateEventForm(valid({ date: '14/10/2026', time: '09:59' }), create).date).toBe('Esa fecha y hora ya pasaron.')
    expect(validateEventForm(valid({ date: '14/10/2026', time: '10:01' }), create).date).toBeUndefined()
  })

  it('al editar sí permite corregir un concierto pasado', () => {
    expect(validateEventForm(valid({ date: '01/01/2026' }), edit)).toEqual({})
  })

  it('imagen opcional pero, si va, debe ser una URL http(s)', () => {
    expect(validateEventForm(valid({ imageUrl: '' }), create).imageUrl).toBeUndefined()
    expect(validateEventForm(valid({ imageUrl: 'cartel.jpg' }), create).imageUrl).toBeDefined()
    expect(validateEventForm(valid({ imageUrl: 'https://cdn.encorely.co/cartel.jpg' }), create).imageUrl).toBeUndefined()
  })

  it('descripción de máximo 2000 caracteres', () => {
    expect(validateEventForm(valid({ description: 'a'.repeat(2001) }), create).description).toMatch(/2000/)
  })

  it('hasErrors ignora claves vacías', () => {
    expect(hasErrors({})).toBe(false)
    expect(hasErrors({ name: undefined })).toBe(false)
    expect(hasErrors({ name: 'x' })).toBe(true)
  })
})

describe('request y precarga', () => {
  it('toEventRequest limpia, convierte la hora y manda null en lo opcional vacío', () => {
    expect(toEventRequest(valid({ name: '  Bomba  ', imageUrl: ' ', description: '' }))).toEqual({
      name: 'Bomba',
      artistLineup: ['Bomba Estéreo', 'Monsieur Periné'],
      venue: 'Movistar Arena',
      city: 'Bogotá',
      startsAt: '2026-11-23T01:00:00.000Z',
      imageUrl: null,
      description: null,
      isPublished: true,
    })
  })

  it('eventToForm muestra la hora de Bogotá y reconoce la ciudad aunque venga sin tilde', () => {
    const event: AdminEvent = {
      id: 'e1',
      name: 'Festival',
      artistLineup: ['A', 'B'],
      venue: 'Parque',
      city: 'Medellin',
      startsAt: '2027-01-01T04:30:00Z',
      imageUrl: null,
      description: 'Desc',
      isPublished: false,
      attendeeCount: 3,
      createdAt: '2026-10-01T00:00:00Z',
    }
    const form = eventToForm(event)
    expect(form).toMatchObject({ cityChoice: 'Medellín', date: '31/12/2026', time: '23:30', isPublished: false })
    expect(eventToForm({ ...event, city: 'Cali' })).toMatchObject({ cityChoice: 'other', otherCity: 'Cali' })
    expect(toEventRequest(form).city).toBe('Medellín')
  })

  it('los errores del back caen en su campo', () => {
    const error = ApiError.fromProblem(400, {
      code: 'validation_failed',
      errors: { Name: ['Muy corto'], ArtistLineup: ['Agrega al menos un artista.'], StartsAt: ['Fecha inválida'] },
    })
    expect(serverEventErrors(error)).toEqual({
      name: 'Muy corto',
      lineup: 'Agrega al menos un artista.',
      date: 'Fecha inválida',
    })
  })
})
