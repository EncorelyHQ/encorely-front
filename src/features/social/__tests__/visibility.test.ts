import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'
import type { Me } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { reactedAtLabel } from '../received'
import { stickerAngleFor, stickerToneFor } from '../stickers'
import { visibilityMutationOptions, visibilityOf } from '../visibility'

describe('visibilityOf', () => {
  it('dice por qué nadie te ve: interruptor apagado o consentimiento pendiente', () => {
    expect(visibilityOf({ showProfileToOthers: true, profileVisible: true })).toBe('visible')
    expect(visibilityOf({ showProfileToOthers: false, profileVisible: false })).toBe('off')
    expect(visibilityOf({ showProfileToOthers: true, profileVisible: false })).toBe('needsConsent')
  })
})

describe('interruptor optimista', () => {
  const me = { id: 'u1', showProfileToOthers: true, profileVisible: true } as Me

  it('mueve el interruptor al instante, toma la respuesta del back y deshace si falla', async () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.me, me)
    const onError = jest.fn()
    const opts = visibilityMutationOptions(qc, jest.fn(), onError)
    const ctx = await opts.onMutate(false)
    expect(qc.getQueryData<Me>(queryKeys.me)).toMatchObject({ showProfileToOthers: false, profileVisible: true })

    opts.onSuccess({ ...me, showProfileToOthers: false, profileVisible: false })
    expect(qc.getQueryData<Me>(queryKeys.me)?.profileVisible).toBe(false)

    const error = new ApiError('network', 'x')
    opts.onError(error, false, ctx)
    expect(qc.getQueryData<Me>(queryKeys.me)).toEqual(me)
    expect(onError).toHaveBeenCalledWith(error)
  })
})

describe('reactedAtLabel', () => {
  const now = new Date(2026, 9, 14, 18, 0).getTime()

  it('hoy, ayer o la fecha corta; el año solo si no es el actual', () => {
    expect(reactedAtLabel(new Date(2026, 9, 14, 1, 0).toISOString(), now)).toBe('hoy')
    expect(reactedAtLabel(new Date(2026, 9, 13, 23, 0).toISOString(), now)).toBe('ayer')
    expect(reactedAtLabel(new Date(2026, 9, 2, 12, 0).toISOString(), now)).toBe('2 oct')
    expect(reactedAtLabel(new Date(2025, 11, 31, 12, 0).toISOString(), now)).toBe('31 dic 2025')
    expect(reactedAtLabel('no-es-fecha', now)).toBe('')
  })
})

describe('stickers estables', () => {
  it('el mismo género tiene siempre el mismo ángulo y color, dentro de ±5°', () => {
    expect(stickerAngleFor('salsa')).toBe(stickerAngleFor('salsa'))
    expect(stickerToneFor('salsa')).toBe(stickerToneFor('salsa'))
    for (const key of ['salsa', 'rock', 'indie', 'vallenato', 'bad-bunny', '']) {
      expect(Math.abs(stickerAngleFor(key))).toBeLessThanOrEqual(5)
    }
  })
})
