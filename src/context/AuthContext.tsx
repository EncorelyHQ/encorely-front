import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SpotifyUser, VibeVector } from '../services/spotifyService';

const STORE_KEY = 'encorely_vibe_vector';

export interface AuthState {
  user: SpotifyUser | null;
  accessToken: string | null;
  vibeVector: VibeVector | null;
  isLoading: boolean;
  setSession: (user: SpotifyUser, token: string, vibe: VibeVector | null) => Promise<void>;
  setVibeVector: (vibe: VibeVector) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [vibeVector, setVibeVectorState] = useState<VibeVector | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted vibe vector on start
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORE_KEY);
        if (stored) setVibeVectorState(JSON.parse(stored));
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setSession = useCallback(
    async (newUser: SpotifyUser, token: string, vibe: VibeVector | null) => {
      setUser(newUser);
      setAccessToken(token);
      if (vibe) {
        setVibeVectorState(vibe);
        await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(vibe));
      }
    },
    []
  );

  const setVibeVector = useCallback(async (vibe: VibeVector) => {
    setVibeVectorState(vibe);
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(vibe));
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY);
    setUser(null);
    setAccessToken(null);
    setVibeVectorState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, vibeVector, isLoading, setSession, setVibeVector, logout }}
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
