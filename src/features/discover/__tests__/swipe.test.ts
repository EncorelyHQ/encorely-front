import { exitDuration, resolveSwipe } from '../model/swipe'

const W = 400

describe('resolveSwipe', () => {
  it('decide por distancia', () => {
    expect(resolveSwipe(120, 0, W)).toBe('like')
    expect(resolveSwipe(-120, 0, W)).toBe('dislike')
    expect(resolveSwipe(60, 0, W)).toBeNull()
  })

  it('decide por velocidad con un recorrido mínimo en la misma dirección', () => {
    expect(resolveSwipe(40, 1200, W)).toBe('like')
    expect(resolveSwipe(-40, -1200, W)).toBe('dislike')
    expect(resolveSwipe(10, 1500, W)).toBeNull()
    expect(resolveSwipe(-40, 1500, W)).toBeNull()
  })
})

describe('exitDuration', () => {
  it('sale más rápido cuanto más rápido fue el lanzamiento, dentro de límites', () => {
    expect(exitDuration(400, 4000)).toBeLessThan(exitDuration(400, 1000))
    expect(exitDuration(10_000, 0)).toBe(260)
    expect(exitDuration(1, 9000)).toBe(140)
  })
})
