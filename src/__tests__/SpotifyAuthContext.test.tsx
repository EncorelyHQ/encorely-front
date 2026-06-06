import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { SpotifyAuthProvider, useSpotifyAuth } from '@/shared/context/SpotifyAuthContext';

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
  digestStringAsync: jest.fn().mockResolvedValue('mock-challenge-base64=='),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
}));

jest.mock('@/shared/lib/secureStorage', () => ({
  secureGetItem: jest.fn().mockResolvedValue(null),
  secureSetItem: jest.fn().mockResolvedValue(undefined),
  secureDeleteItems: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/clients/spotify/spotifyApi', () => ({
  exchangeCodeForTokens: jest.fn(),
  refreshAccessToken: jest.fn(),
  getCurrentUser: jest.fn(),
}));

jest.mock('@/clients/api', () => ({
  authWithSpotify: jest.fn(),
}));

jest.mock('@/shared/context/AuthContext', () => ({
  useAuth: () => ({ setBackendIdentity: jest.fn() }),
}));

jest.mock('@/config/spotify', () => ({
  getSpotifyClientId: () => 'test-client-id',
  getSpotifyRedirectUri: () => 'encorely://auth/callback',
}));

import {
  secureGetItem,
  secureSetItem,
  secureDeleteItems,
} from '@/shared/lib/secureStorage';
import { refreshAccessToken } from '@/clients/spotify/spotifyApi';

const mockSecureGetItem = secureGetItem as jest.Mock;
const mockSecureSetItem = secureSetItem as jest.Mock;
const mockSecureDeleteItems = secureDeleteItems as jest.Mock;
const mockRefreshToken = refreshAccessToken as jest.Mock;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SpotifyAuthProvider>{children}</SpotifyAuthProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureGetItem.mockResolvedValue(null);
  mockSecureSetItem.mockResolvedValue(undefined);
  mockSecureDeleteItems.mockResolvedValue(undefined);
});

describe('SpotifyAuthProvider', () => {
  it('termina en isLoading=false tras cargar', async () => {
    const { result } = await renderHook(() => useSpotifyAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('inicia con user=null y accessToken=null cuando no hay sesión guardada', async () => {
    const { result } = await renderHook(() => useSpotifyAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });

  it('restaura la sesión desde SecureStore cuando hay tokens almacenados', async () => {
    const storedUser = { id: 'sp-123', display_name: 'Test User', email: 'u@e.com', images: [] };
    mockSecureGetItem
      .mockResolvedValueOnce('stored-access-token')
      .mockResolvedValueOnce('stored-refresh-token')
      .mockResolvedValueOnce(String(Date.now() + 3_600_000))
      .mockResolvedValueOnce(JSON.stringify(storedUser));

    const { result } = await renderHook(() => useSpotifyAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.accessToken).toBe('stored-access-token');
    expect(result.current.user).toMatchObject({ id: 'sp-123' });
  });

  it('logout limpia el estado y borra SecureStore', async () => {
    const storedUser = { id: 'sp-123', display_name: 'Test User', email: 'u@e.com', images: [] };
    mockSecureGetItem
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce(String(Date.now() + 3_600_000))
      .mockResolvedValueOnce(JSON.stringify(storedUser));

    const { result } = await renderHook(() => useSpotifyAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(mockSecureDeleteItems).toHaveBeenCalled();
  });

  it('getValidToken retorna el token actual cuando no ha expirado', async () => {
    // El user debe ser non-null para que el `if (token && refresh && storedUser)` pase
    // y setStoredRefreshToken sea llamado (requerido por getValidToken)
    const storedUser = { id: 'sp-1', display_name: 'Test', email: 'u@e.com', images: [] };
    const futureExpiry = String(Date.now() + 3_600_000);
    mockSecureGetItem
      .mockResolvedValueOnce('valid-token')
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce(futureExpiry)
      .mockResolvedValueOnce(JSON.stringify(storedUser));

    const { result } = await renderHook(() => useSpotifyAuth(), { wrapper });
    await waitFor(() => expect(result.current.accessToken).toBe('valid-token'));

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getValidToken();
    });

    expect(token).toBe('valid-token');
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('getValidToken llama refreshAccessToken cuando el token ha expirado', async () => {
    const storedUser = { id: 'sp-1', display_name: 'Test', email: 'u@e.com', images: [] };
    const pastExpiry = String(Date.now() - 1000);
    mockSecureGetItem
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce(pastExpiry)
      .mockResolvedValueOnce(JSON.stringify(storedUser));

    mockRefreshToken.mockResolvedValue({
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
      expiresIn: 3600,
    });

    const { result } = await renderHook(() => useSpotifyAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getValidToken();
    });

    expect(mockRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(token).toBe('new-token');
  });

  it('lanza un error si useSpotifyAuth se usa fuera del Provider', async () => {
    let caught: Error | null = null;
    try {
      await renderHook(() => useSpotifyAuth());
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toBe('useSpotifyAuth must be used within SpotifyAuthProvider');
  });
});
