import { affinityPercent, affinitySentence, roundAffinity } from '../affinity'

describe('afinidad honesta', () => {
  it('redondea de 5 en 5 y se queda entre 0 y 100', () => {
    expect([0, 2, 3, 77, 78, 82, 97, 98, 100].map(roundAffinity)).toEqual([0, 0, 5, 75, 80, 80, 95, 100, 100])
    expect(roundAffinity(-4)).toBe(0)
    expect(roundAffinity(130)).toBe(100)
  })

  it('dice "de gustos en común" con espacio no separable y nada si no hay señal', () => {
    expect(affinitySentence(78)).toBe('80 % de gustos en común')
    expect(affinityPercent(78)).toBe('80 %')
    expect(affinitySentence(null)).toBeNull()
  })
})
