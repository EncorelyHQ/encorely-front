import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { attendanceMutationOptions } from '../mutations'
import { makeEvent, makePerson } from '../__fixtures__/events'

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  qc.setQueryData(queryKeys.events('Bogotá'), [makeEvent(), makeEvent({ id: 'e2' })])
  qc.setQueryData(queryKeys.events(), [makeEvent()])
  qc.setQueryData(queryKeys.event('e1'), makeEvent())
  qc.setQueryData(queryKeys.radar('e1'), [makePerson()])
  return qc
}

describe('asistencia optimista', () => {
  it('marca que voy en todas las cachés antes de la respuesta', async () => {
    const qc = setup()
    const opts = attendanceMutationOptions(qc, 'e1', { attend: jest.fn(), unattend: jest.fn(), onError: jest.fn() })
    await opts.onMutate({ going: true })
    const list = qc.getQueryData<ReturnType<typeof makeEvent>[]>(queryKeys.events('Bogotá'))!
    expect(list[0]).toMatchObject({ iAmGoing: true, attendeeCount: 4 })
    expect(list[1].iAmGoing).toBe(false)
    expect(qc.getQueryData(queryKeys.event('e1'))).toMatchObject({ iAmGoing: true, attendeeCount: 4 })
    // El radar vive bajo el mismo prefijo y no se toca.
    expect(qc.getQueryData(queryKeys.radar('e1'))).toEqual([makePerson()])
  })

  it('reemplaza con el evento real que devuelve el back', async () => {
    const qc = setup()
    const opts = attendanceMutationOptions(qc, 'e1', { attend: jest.fn(), unattend: jest.fn(), onError: jest.fn() })
    await opts.onMutate({ going: true })
    opts.onSuccess(makeEvent({ iAmGoing: true, attendeeCount: 10 }))
    expect(qc.getQueryData(queryKeys.event('e1'))).toMatchObject({ attendeeCount: 10 })
  })

  it('deshace el cambio y avisa si falla', async () => {
    const qc = setup()
    const onError = jest.fn()
    const opts = attendanceMutationOptions(qc, 'e1', { attend: jest.fn(), unattend: jest.fn(), onError })
    const ctx = await opts.onMutate({ going: true })
    const error = new Error('offline')
    opts.onError(error, { going: true }, ctx)
    expect(qc.getQueryData(queryKeys.event('e1'))).toMatchObject({ iAmGoing: false, attendeeCount: 3 })
    expect(qc.getQueryData<ReturnType<typeof makeEvent>[]>(queryKeys.events())![0].iAmGoing).toBe(false)
    expect(onError).toHaveBeenCalledWith(error, true)
  })

  it('llama al endpoint según la dirección', () => {
    const attend = jest.fn().mockResolvedValue(makeEvent())
    const unattend = jest.fn().mockResolvedValue(makeEvent())
    const opts = attendanceMutationOptions(setup(), 'e1', { attend, unattend, onError: jest.fn() })
    void opts.mutationFn({ going: true })
    void opts.mutationFn({ going: false })
    expect(attend).toHaveBeenCalledWith('e1')
    expect(unattend).toHaveBeenCalledWith('e1')
  })
})
