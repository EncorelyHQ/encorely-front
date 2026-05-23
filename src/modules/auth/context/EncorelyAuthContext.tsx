import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getUserMe } from '@/clients/encorely/userClient';
import type { UserProfile } from '@/clients/encorely/types';
import { getEncorelyUserId } from '@/clients/encorely/lib/session';
import { authService } from '@/modules/auth/services/authService';
import {
  registerSpotifyTokenHandler,
  unregisterSpotifyTokenHandler,
} from '@/modules/auth/lib/spotifyBridge';

export interface EncorelyAuthState {
  userId: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  loginWithSpotifyToken: (spotifyAccessToken: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
}

const EncorelyAuthContext = createContext<EncorelyAuthState | null>(null);

export function EncorelyAuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const id = userId ?? (await getEncorelyUserId());
    if (!id) return null;
    try {
      const me = await getUserMe(id);
      setUserId(me.id);
      setProfile(me);
      setError(null);
      return me;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar perfil';
      setError(msg);
      return null;
    }
  }, [userId]);

  const loginWithSpotifyToken = useCallback(
    async (spotifyAccessToken: string) => {
      setError(null);
      const session = await authService.loginWithSpotify(spotifyAccessToken);
      setUserId(session.userId);
      const me = await getUserMe(session.userId);
      setProfile(me);
    },
    []
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUserId(null);
    setProfile(null);
    setError(null);
  }, []);

  useEffect(() => {
    registerSpotifyTokenHandler(loginWithSpotifyToken);
    return () => unregisterSpotifyTokenHandler();
  }, [loginWithSpotifyToken]);

  useEffect(() => {
    (async () => {
      try {
        const storedId = await getEncorelyUserId();
        if (storedId) {
          setUserId(storedId);
          const me = await getUserMe(storedId);
          setProfile(me);
        }
      } catch (e) {
        console.warn('[EncorelyAuth] Restore session:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<EncorelyAuthState>(
    () => ({
      userId,
      profile,
      isLoading,
      error,
      isAuthenticated: !!userId,
      loginWithSpotifyToken,
      refreshProfile,
      logout,
    }),
    [
      userId,
      profile,
      isLoading,
      error,
      loginWithSpotifyToken,
      refreshProfile,
      logout,
    ]
  );

  return (
    <EncorelyAuthContext.Provider value={value}>{children}</EncorelyAuthContext.Provider>
  );
}

export function useEncorelyAuthContext(): EncorelyAuthState {
  const ctx = useContext(EncorelyAuthContext);
  if (!ctx) {
    throw new Error('useEncorelyAuth must be used within EncorelyAuthProvider');
  }
  return ctx;
}
