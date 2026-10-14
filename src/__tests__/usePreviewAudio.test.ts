import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { usePreviewAudio } from '@/modules/swipe/hooks/usePreviewAudio';

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

const mockCreatePlayer = jest.mocked(createAudioPlayer);
const mockAudioMode = jest.mocked(setAudioModeAsync);
const makePlayer = () => ({
  isLoaded: true,
  playing: false,
  play: jest.fn(),
  pause: jest.fn(),
  remove: jest.fn(),
  addListener: jest.fn((_event: string, _listener: (status: object) => void) => ({ remove: jest.fn() })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAudioMode.mockResolvedValue(undefined);
});

it('mantiene la tarjeta disponible cuando no se puede crear el reproductor', async () => {
  mockCreatePlayer.mockImplementationOnce(() => { throw new Error('Audio unavailable'); });
  const { result } = await renderHook(() => usePreviewAudio('preview.mp3', true));
  expect(result.current.isPlaying).toBe(false);
  expect(result.current.progress).toBe(0);
});

it('no crea audio para tarjetas traseras o sin preview', async () => {
  const { rerender } = await renderHook(({ front, url }: { front: boolean; url: string }) => usePreviewAudio(url, front), {
    initialProps: { front: false, url: 'https://example.com/preview.mp3' },
  });
  await rerender({ front: true, url: '' });
  expect(mockCreatePlayer).not.toHaveBeenCalled();
});

it('reproduce, pausa y libera la tarjeta al salir del frente', async () => {
  const player = makePlayer();
  mockCreatePlayer.mockReturnValue(player as unknown as ReturnType<typeof createAudioPlayer>);
  const { result, rerender } = await renderHook(({ front }: { front: boolean }) => usePreviewAudio('preview.mp3', front), {
    initialProps: { front: true },
  });
  await waitFor(() => expect(player.play).toHaveBeenCalledTimes(1));
  player.playing = true;
  await act(() => result.current.togglePlay());
  expect(player.pause).toHaveBeenCalledTimes(1);
  await rerender({ front: false });
  expect(player.remove).toHaveBeenCalledTimes(1);
});

it('ignora la carga tardía de una tarjeta desmontada', async () => {
  let finishMode!: () => void;
  mockAudioMode.mockImplementation(() => new Promise<void>((resolve) => { finishMode = resolve; }));
  const player = makePlayer();
  mockCreatePlayer.mockReturnValue(player as unknown as ReturnType<typeof createAudioPlayer>);
  const { unmount } = await renderHook(() => usePreviewAudio('preview.mp3', true));
  await unmount();
  await act(async () => { finishMode(); });
  expect(player.play).not.toHaveBeenCalled();
  expect(player.remove).toHaveBeenCalledTimes(1);
});

it('actualiza el progreso y el fin de pista', async () => {
  const player = makePlayer();
  mockCreatePlayer.mockReturnValue(player as unknown as ReturnType<typeof createAudioPlayer>);
  const { result } = await renderHook(() => usePreviewAudio('preview.mp3', true));
  const notify = player.addListener.mock.calls[0][1] as (status: object) => void;
  await act(() => notify({ playing: true, currentTime: 5, duration: 10, didJustFinish: false }));
  expect(result.current.progress).toBe(0.5);
  expect(result.current.isPlaying).toBe(true);
  await act(() => notify({ playing: false, currentTime: 10, duration: 10, didJustFinish: true }));
  expect(result.current.progress).toBe(1);
  expect(result.current.isPlaying).toBe(false);
});

it('libera el reproductor cuando falla la configuración de audio', async () => {
  mockAudioMode.mockRejectedValue(new Error('Audio unavailable'));
  const player = makePlayer();
  mockCreatePlayer.mockReturnValue(player as unknown as ReturnType<typeof createAudioPlayer>);
  await renderHook(() => usePreviewAudio('preview.mp3', true));
  await waitFor(() => expect(player.remove).toHaveBeenCalledTimes(1));
  expect(player.play).not.toHaveBeenCalled();
});
