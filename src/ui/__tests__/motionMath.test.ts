import { carouselOffset, parallaxProgress, revealProgress, stickerAngle } from '../motionMath'

describe('revealProgress', () => {
  it('va de 0 cuando la sección apenas asoma a 1 cuando entró 240 pt', () => {
    expect(revealProgress(800, 800)).toBe(0)
    expect(revealProgress(800, 900)).toBe(0)
    expect(revealProgress(800, 800 - 24 - 120)).toBeCloseTo(0.5)
    expect(revealProgress(800, 100)).toBe(1)
  })
})

describe('parallaxProgress', () => {
  it('se completa a los 260 pt y no pasa de ahí', () => {
    expect(parallaxProgress(0)).toBe(0)
    expect(parallaxProgress(130)).toBeCloseTo(0.5)
    expect(parallaxProgress(1000)).toBe(1)
    expect(parallaxProgress(-50)).toBe(0)
  })
})

describe('carouselOffset', () => {
  it('es 0 en el centro y se satura en ±1', () => {
    expect(carouselOffset(200, 0, 400)).toBe(0)
    expect(carouselOffset(400, 0, 400)).toBe(1)
    expect(carouselOffset(0, 0, 400)).toBe(-1)
    expect(carouselOffset(5000, 0, 400)).toBe(1)
    expect(carouselOffset(600, 400, 400)).toBe(0)
  })

  it('no divide entre cero antes de medir', () => {
    expect(Number.isFinite(carouselOffset(100, 0, 0))).toBe(true)
  })
})

describe('stickerAngle', () => {
  it('respeta el ángulo con fuente normal y lo baja a ±1° desde 150 %', () => {
    expect(stickerAngle(-6, 1)).toBe(-6)
    expect(stickerAngle(-6, 1.49)).toBe(-6)
    expect(stickerAngle(-6, 1.5)).toBe(-1)
    expect(stickerAngle(5, 2)).toBe(1)
    expect(stickerAngle(0.5, 2)).toBe(0.5)
  })
})
