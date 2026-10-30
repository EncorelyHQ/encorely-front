import type { ApiError } from '@/lib/api/errors'
import type { AdminEvent, AdminEventRequest } from '../types'
import { bogotaToIso, isoToBogota, parseDateInput, parseTimeInput } from './datetime'

export const CITY_PRESETS = ['Bogotá', 'Medellín'] as const
export type CityChoice = (typeof CITY_PRESETS)[number] | 'other'

export type EventFormValues = {
  name: string
  lineup: string[]
  venue: string
  cityChoice: CityChoice
  otherCity: string
  date: string
  time: string
  imageUrl: string
  description: string
  isPublished: boolean
}

export type EventFormField = 'name' | 'lineup' | 'venue' | 'city' | 'date' | 'time' | 'imageUrl' | 'description'
export type EventFormErrors = Partial<Record<EventFormField, string>>

// Los mismos límites que AdminEventRequest en el back: el error aparece antes de mandar.
export const EVENT_LIMITS = {
  nameMin: 3,
  nameMax: 200,
  venueMin: 2,
  venueMax: 200,
  cityMin: 2,
  cityMax: 80,
  lineupMax: 30,
  imageUrlMax: 500,
  descriptionMax: 2000,
} as const

export function emptyEventForm(): EventFormValues {
  return {
    name: '',
    lineup: [''],
    venue: '',
    cityChoice: 'Bogotá',
    otherCity: '',
    date: '',
    time: '',
    imageUrl: '',
    description: '',
    isPublished: true,
  }
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

export function cityChoiceFor(city: string): CityChoice {
  return CITY_PRESETS.find((preset) => normalize(preset) === normalize(city)) ?? 'other'
}

export function eventToForm(event: AdminEvent): EventFormValues {
  const local = isoToBogota(event.startsAt)
  const cityChoice = cityChoiceFor(event.city)
  return {
    name: event.name,
    lineup: event.artistLineup.length > 0 ? [...event.artistLineup] : [''],
    venue: event.venue,
    cityChoice,
    otherCity: cityChoice === 'other' ? event.city : '',
    date: local?.date ?? '',
    time: local?.time ?? '',
    imageUrl: event.imageUrl ?? '',
    description: event.description ?? '',
    isPublished: event.isPublished,
  }
}

export function cleanLineup(lineup: readonly string[]): string[] {
  return lineup.map((artist) => artist.trim()).filter((artist) => artist.length > 0)
}

export function resolvedCity(values: EventFormValues): string {
  return values.cityChoice === 'other' ? values.otherCity.trim() : values.cityChoice
}

const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i

type ValidateOptions = {
  now: Date
  // Al crear no tiene sentido un concierto que ya pasó; al editar se permite corregir datos de uno viejo.
  requireFuture: boolean
}

export function validateEventForm(values: EventFormValues, { now, requireFuture }: ValidateOptions): EventFormErrors {
  const errors: EventFormErrors = {}
  const L = EVENT_LIMITS

  const name = values.name.trim()
  if (!name) errors.name = 'Escribe el nombre del concierto.'
  else if (name.length < L.nameMin || name.length > L.nameMax)
    errors.name = `El nombre debe tener entre ${L.nameMin} y ${L.nameMax} caracteres.`

  const lineup = cleanLineup(values.lineup)
  const unique = new Set(lineup.map(normalize))
  if (lineup.length === 0) errors.lineup = 'Agrega al menos un artista.'
  else if (lineup.length > L.lineupMax) errors.lineup = `Máximo ${L.lineupMax} artistas.`
  else if (unique.size !== lineup.length) errors.lineup = 'Hay artistas repetidos. Deja cada uno una sola vez.'

  const venue = values.venue.trim()
  if (!venue) errors.venue = 'Escribe el lugar.'
  else if (venue.length < L.venueMin || venue.length > L.venueMax)
    errors.venue = `El lugar debe tener entre ${L.venueMin} y ${L.venueMax} caracteres.`

  const city = resolvedCity(values)
  if (!city) errors.city = 'Escribe la ciudad.'
  else if (city.length < L.cityMin || city.length > L.cityMax)
    errors.city = `La ciudad debe tener entre ${L.cityMin} y ${L.cityMax} caracteres.`

  const date = parseDateInput(values.date)
  if (!date.ok) {
    errors.date =
      date.reason === 'empty'
        ? 'Escribe la fecha.'
        : date.reason === 'format'
          ? 'Usa el formato DD/MM/AAAA.'
          : 'Esa fecha no existe. Revisa el día y el mes.'
  }

  const time = parseTimeInput(values.time)
  if (!time.ok) {
    errors.time =
      time.reason === 'empty' ? 'Escribe la hora.' : 'Usa el formato HH:MM, de 00:00 a 23:59.'
  }

  if (date.ok && time.ok && requireFuture) {
    const iso = bogotaToIso(values.date, values.time)
    if (iso && Date.parse(iso) <= now.getTime()) errors.date = 'Esa fecha y hora ya pasaron.'
  }

  const imageUrl = values.imageUrl.trim()
  if (imageUrl && (imageUrl.length > L.imageUrlMax || !URL_PATTERN.test(imageUrl)))
    errors.imageUrl = 'Pega una dirección completa que empiece por https://.'

  if (values.description.trim().length > L.descriptionMax)
    errors.description = `Máximo ${L.descriptionMax} caracteres.`

  return errors
}

export function hasErrors(errors: EventFormErrors): boolean {
  return Object.values(errors).some(Boolean)
}

// Solo se llama con el formulario válido: la fecha ya se comprobó.
export function toEventRequest(values: EventFormValues): AdminEventRequest {
  const imageUrl = values.imageUrl.trim()
  const description = values.description.trim()
  return {
    name: values.name.trim(),
    artistLineup: cleanLineup(values.lineup),
    venue: values.venue.trim(),
    city: resolvedCity(values),
    startsAt: bogotaToIso(values.date, values.time) ?? '',
    imageUrl: imageUrl || null,
    description: description || null,
    isPublished: values.isPublished,
  }
}

const SERVER_FIELDS: Record<string, EventFormField> = {
  name: 'name',
  artistLineup: 'lineup',
  venue: 'venue',
  city: 'city',
  startsAt: 'date',
  imageUrl: 'imageUrl',
  description: 'description',
}

// Los errores de validación del back (ProblemDetails.errors) caen en el campo que corresponde.
export function serverEventErrors(error: ApiError): EventFormErrors {
  const out: EventFormErrors = {}
  for (const [key, field] of Object.entries(SERVER_FIELDS)) {
    const message = error.field(key)
    if (message) out[field] = message
  }
  return out
}
