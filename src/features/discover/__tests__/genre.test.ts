import { songGenre } from '../model/genre'

it('usa el nombre del API y solo formatea el slug si viene vacío', () => {
  expect(songGenre({ genre: 'musica-urbana', genreName: 'Música urbana' })).toBe('Música urbana')
  expect(songGenre({ genre: 'musica-urbana', genreName: '' })).toBe('Musica urbana')
})
