import { act, renderHook } from '@testing-library/react-native'
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import { resetAudioModeForTests, usePreviewAudio } from '../hooks/usePreviewAudio'

type StatusListener = (status: { playing: boolean; didJustFinish: boolean; currentTime: number; duration: number }) => void

type FakePlayer = {
  uri: string
  playing: boolean
  listener: StatusListener | null
  play: jest.Mock
  pause: jest.Mock
  remove: jest.Mock
  seekTo: jest.Mock
  unsubscribe: jest.Mock
  addListener: jest.Mock
}

const players: FakePlayer[] = []

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn((source: { uri: string }) => {
    const player: FakePlayer = {
      uri: source.uri,
      playing: false,
      listener: null,
      play: jest.fn(() => {
        player.playing = true
      }),
      pause: jest.fn(() => {
        player.playing = false
      }),
      remove: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      unsubscribe: jest.fn(),
      addListener: jest.fn((_event: string, cb: StatusListener) => {
        player.listener = cb
        return { remove: player.unsubscribe }
      }),
    }
    players.push(player)
    return player
  }),
}))

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (initial: number) => {
    // Shared value mínimo: los tests solo leen y escriben el número.
    const { useRef } = jest.requireActual<typeof import('react')>('react')
    const ref = useRef<{ value: number; get: () => number; set: (v: number) => void } | null>(null)
    if (!ref.current) {
      const box = {
        value: initial,
        get: () => box.value,
        set: (v: number) => {
          box.value = v
        },
      }
      ref.current = box
    }
    return ref.current
  },
}))

const flush = () => act(async () => {})

const trackA = { id: 'a', previewUrl: 'https://audio.test/a.m4a' }
const trackB = { id: 'b', previewUrl: 'https://audio.test/b.m4a' }

beforeEach(() => {
  players.length = 0
  jest.clearAllMocks()
  resetAudioModeForTests()
})

describe('usePreviewAudio', () => {
  it('respeta el modo silencio y arranca solo con la pantalla activa', async () => {
    await renderHook(() => usePreviewAudio(trackA, { active: true, autoplay: true }))
    await flush()
    expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: false }))
    expect(players[0].play).toHaveBeenCalledTimes(1)
  })

  it('no arranca si la pantalla no está enfocada', async () => {
    await renderHook(() => usePreviewAudio(trackA, { active: false, autoplay: true }))
    await flush()
    expect(players[0].play).not.toHaveBeenCalled()
  })

  it('pausa al perder el foco o pasar a segundo plano', async () => {
    const { rerender } = await renderHook(({ active }: { active: boolean }) => usePreviewAudio(trackA, { active, autoplay: true }), {
      initialProps: { active: true },
    })
    await flush()
    await rerender({ active: false })
    expect(players[0].pause).toHaveBeenCalled()
    expect(players[0].remove).not.toHaveBeenCalled()
  })

  it('libera el player al cambiar de tarjeta y crea uno nuevo', async () => {
    const { rerender } = await renderHook(({ track }: { track: typeof trackA }) => usePreviewAudio(track, { active: true, autoplay: true }), {
      initialProps: { track: trackA },
    })
    await flush()
    await rerender({ track: trackB })
    await flush()
    expect(players[0].unsubscribe).toHaveBeenCalled()
    expect(players[0].remove).toHaveBeenCalled()
    expect(players[1].uri).toBe(trackB.previewUrl)
    expect(players[1].play).toHaveBeenCalled()
  })

  it('libera el player al desmontar', async () => {
    const { unmount } = await renderHook(() => usePreviewAudio(trackA, { active: true, autoplay: true }))
    await flush()
    await unmount()
    expect(players[0].pause).toHaveBeenCalled()
    expect(players[0].remove).toHaveBeenCalled()
  })

  it('sin vista previa no crea player y lo reporta como no disponible', async () => {
    const { result } = await renderHook(() =>
      usePreviewAudio({ id: 'c', previewUrl: null }, { active: true, autoplay: true }),
    )
    expect(createAudioPlayer).not.toHaveBeenCalled()
    expect(result.current.available).toBe(false)
    expect(result.current.isPlaying).toBe(false)
  })

  it('una pausa manual no se deshace al recuperar el foco', async () => {
    const { result, rerender } = await renderHook(({ active }: { active: boolean }) => usePreviewAudio(trackA, { active, autoplay: true }), {
      initialProps: { active: true },
    })
    await flush()
    await act(async () => result.current.toggle())
    expect(players[0].pause).toHaveBeenCalled()
    await rerender({ active: false })
    await rerender({ active: true })
    await flush()
    expect(players[0].play).toHaveBeenCalledTimes(1)
  })

  it('refleja el estado de reproducción y el progreso desde el player', async () => {
    const { result } = await renderHook(() => usePreviewAudio(trackA, { active: true, autoplay: true }))
    await flush()
    await act(async () => players[0].listener?.({ playing: true, didJustFinish: false, currentTime: 15, duration: 30 }))
    expect(result.current.isPlaying).toBe(true)
    expect(result.current.progress.value).toBeCloseTo(0.5)
  })

  it('con lector de pantalla no hace autoplay pero el botón sí reproduce', async () => {
    const { result } = await renderHook(() => usePreviewAudio(trackA, { active: true, autoplay: false }))
    await flush()
    expect(players[0].play).not.toHaveBeenCalled()
    await act(async () => result.current.toggle())
    await flush()
    expect(players[0].play).toHaveBeenCalledTimes(1)
  })
})
