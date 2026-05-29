import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { secureGetItem, secureSetItem, secureDeleteItem } from '@/shared/lib/secureStorage';
import type { SpotifyUser } from '@/clients/spotify/spotifyApi';
import type { VibeVector } from '@/shared/types/vibe';

const STORE_KEY = 'encorely_vibe_vector';
const BACKEND_USER_ID_KEY = 'encorely_backend_user_id';
const BACKEND_TOKEN_KEY = 'encorely_backend_token';

export interface AuthState {
  user: SpotifyUser | null;
  accessToken: string | null;
  vibeVector: VibeVector | null;
  /** GUID de identidad del backend Encorely (requerido por todos los endpoints). */
  backendUserId: string | null;
  /** JWT emitido por el backend (opcional; el backend no lo exige aún). */
  backendToken: string | null;
  isLoading: boolean;
  setSession: (user: SpotifyUser, token: string, vibe: VibeVector | null) => Promise<void>;
  setVibeVector: (vibe: VibeVector) => Promise<void>;
  /** Persiste la identidad de backend obtenida tras login (Spotify/email/google). */
  setBackendIdentity: (userId: string, token?: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [vibeVector, setVibeVectorState] = useState<VibeVector | null>(null);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [backendToken, setBackendToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [stored, storedId, storedToken] = await Promise.all([
          secureGetItem(STORE_KEY),
          secureGetItem(BACKEND_USER_ID_KEY),
          secureGetItem(BACKEND_TOKEN_KEY),
        ]);
        if (stored) setVibeVectorState(JSON.parse(stored));
        if (storedId) setBackendUserId(storedId);
        if (storedToken) setBackendToken(storedToken);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setBackendIdentity = useCallback(
    async (userId: string, token?: string | null) => {
      setBackendUserId(userId);
      await secureSetItem(BACKEND_USER_ID_KEY, userId);
      if (token) {
        setBackendToken(token);
        await secureSetItem(BACKEND_TOKEN_KEY, token);
      }
    },
    []
  );

  const setSession = useCallback(
    async (newUser: SpotifyUser, token: string, vibe: VibeVector | null) => {
      setUser(newUser);
      setAccessToken(token);
      if (vibe) {
        setVibeVectorState(vibe);
        await secureSetItem(STORE_KEY, JSON.stringify(vibe));
      }
    },
    []
  );

  const setVibeVector = useCallback(async (vibe: VibeVector) => {
    setVibeVectorState(vibe);
    await secureSetItem(STORE_KEY, JSON.stringify(vibe));
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      secureDeleteItem(STORE_KEY),
      secureDeleteItem(BACKEND_USER_ID_KEY),
      secureDeleteItem(BACKEND_TOKEN_KEY),
    ]);
    setUser(null);
    setAccessToken(null);
    setVibeVectorState(null);
    setBackendUserId(null);
    setBackendToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        vibeVector,
        backendUserId,
        backendToken,
        isLoading,
        setSession,
        setVibeVector,
        setBackendIdentity,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
