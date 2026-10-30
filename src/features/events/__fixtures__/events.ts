import type { EventSummary, RadarPerson } from '@/lib/api/types'

export const makeEvent = (over: Partial<EventSummary> = {}): EventSummary => ({
  id: 'e1',
  name: 'Andrés Cepeda',
  artistLineup: ['Andrés Cepeda'],
  venue: 'Movistar Arena',
  city: 'Bogotá',
  // 22 nov 2026, 8:00 p. m. en Bogotá (UTC-5).
  startsAt: '2026-11-23T01:00:00Z',
  imageUrl: null,
  description: null,
  attendeeCount: 3,
  iAmGoing: false,
  ...over,
})

export const makePerson = (over: Partial<RadarPerson> = {}): RadarPerson => ({
  userId: 'u1',
  displayName: 'Ana Gómez',
  age: 27,
  city: 'Bogotá',
  affinity: 78,
  sharedGenres: ['salsa'],
  likedByMe: false,
  matched: false,
  ...over,
})
