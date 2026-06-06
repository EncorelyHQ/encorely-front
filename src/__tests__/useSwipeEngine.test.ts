import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSwipeEngine } from '@/modules/swipe/hooks/useSwipeEngine';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/clients/api', () => ({
  registerSwipe: jest.fn().mockResolvedValue(undefined),
  SwipeDirection: { Dislike: 0, Like: 1, Superlike: 2 },
}));

jest.mock('@/shared/context/AuthContext', () => ({
  useAuth: () => ({ backendUserId: 'user-uuid-123' }),
}));

jest.mock('@/config/onboarding', () => ({
  ONBOARDING_SWIPES_REQUIRED: 5,
  RADAR_SWIPES_THRESHOLD: 25,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerSwipe, SwipeDirection } from '@/clients/api';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRegisterSwipe = registerSwipe as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockRegisterSwipe.mockResolvedValue(undefined);
});

describe('useSwipeEngine', () => {
  it('arranca con estado vacío y marca isLoaded=true después de cargar', async () => {
    const { result } = await renderHook(() => useSwipeEngine());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.swipesCount).toBe(0);
    expect(result.current.likes).toEqual([]);
    expect(result.current.dislikes).toEqual([]);
  });

  it('restaura el estado guardado en AsyncStorage', async () => {
    const saved = JSON.stringify({ swipesCount: 3, likes: ['t1', 't2'], dislikes: ['t3'] });
    mockGetItem.mockResolvedValue(saved);

    const { result } = await renderHook(() => useSwipeEngine());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.swipesCount).toBe(3);
    expect(result.current.likes).toEqual(['t1', 't2']);
    expect(result.current.dislikes).toEqual(['t3']);
  });

  it('like() incrementa count, añade trackId y llama registerSwipe', async () => {
    const { result } = await renderHook(() => useSwipeEngine());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.like('track-a');
    });

    expect(result.current.swipesCount).toBe(1);
    expect(result.current.likes).toContain('track-a');
    expect(mockRegisterSwipe).toHaveBeenCalledWith('user-uuid-123', 'track-a', SwipeDirection.Like);
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('dislike() incrementa count, añade trackId y llama registerSwipe', async () => {
    const { result } = await renderHook(() => useSwipeEngine());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.dislike('track-b');
    });

    expect(result.current.swipesCount).toBe(1);
    expect(result.current.dislikes).toContain('track-b');
    expect(mockRegisterSwipe).toHaveBeenCalledWith('user-uuid-123', 'track-b', SwipeDirection.Dislike);
  });

  it('resetSwipes() limpia el estado y escribe ceros en AsyncStorage', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ swipesCount: 10, likes: ['t1'], dislikes: ['t2'] })
    );
    const { result } = await renderHook(() => useSwipeEngine());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.resetSwipes();
    });

    expect(result.current.swipesCount).toBe(0);
    expect(result.current.likes).toEqual([]);
    expect(result.current.dislikes).toEqual([]);
    expect(mockSetItem).toHaveBeenCalledWith(
      '@encorely_swipe_state',
      JSON.stringify({ swipesCount: 0, likes: [], dislikes: [] })
    );
  });

  it('hasCompletedOnboardingSwipes es false cuando count < ONBOARDING_SWIPES_REQUIRED', async () => {
    const { result } = await renderHook(() => useSwipeEngine());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.hasCompletedOnboardingSwipes).toBe(false);
  });

  it('hasCompletedOnboardingSwipes es true cuando count >= ONBOARDING_SWIPES_REQUIRED', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ swipesCount: 5, likes: [], dislikes: [] })
    );
    const { result } = await renderHook(() => useSwipeEngine());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.hasCompletedOnboardingSwipes).toBe(true);
  });
});
