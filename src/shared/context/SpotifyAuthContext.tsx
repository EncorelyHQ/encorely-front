import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  secureGetItem,
  secureSetItem,
  secureDeleteItems,
} from '@/shared/lib/secureStorage';
import * as Crypto from 'expo-crypto';
import { getSpotifyClientId, getSpotifyRedirectUri } from '@/config/spotify';
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  getCurrentUser,
  type SpotifyUser,
  type SpotifyTokens,
} from '@/clients/spotify/spotifyApi';

WebBrowser.maybeCompleteAuthSession();

const SCOPES = [
  'user-read-recently-played',
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-email',
  'user-read-private',
  'user-top-read',
].join('%20');

const STORE_KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
  user: 'spotify_user',
  codeVerifier: 'spotify_code_verifier',
} as const;

const WEB_VERIFIER_STORAGE_KEY = 'encorely_web_spotify_pkce_v1';
const WEB_REDIRECT_STORAGE_KEY = 'encorely_web_spotify_redirect_v1';

async function generateCodeVerifier(): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(32);
  return btoa(String.fromCharCode(...random))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export interface SpotifyAuthState {
  user: SpotifyUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isLoggingIn: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
}

const SpotifyAuthContext = createContext<SpotifyAuthState | null>(null);

export function SpotifyAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [storedRefreshToken, setStoredRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkceRef = useRef<{ verifier: string; challenge: string } | null>(null);

  useEffect(() => {
    if (__DEV__) {
      console.log(
        '[Encorely] Spotify redirect URI (must match Dashboard):',
        getSpotifyRedirectUri()
      );
    }
  }, []);

  const refreshPkcePair = useCallback(async () => {
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    pkceRef.current = { verifier, challenge };
    void secureSetItem(STORE_KEYS.codeVerifier, verifier);
  }, []);

  useEffect(() => {
    void refreshPkcePair();
  }, [refreshPkcePair]);

  useEffect(() => {
    (async () => {
      try {
        const [token, refresh, expires, storedUser] = await Promise.all([
          secureGetItem(STORE_KEYS.accessToken),
          secureGetItem(STORE_KEYS.refreshToken),
          secureGetItem(STORE_KEYS.expiresAt),
          secureGetItem(STORE_KEYS.user),
        ]);
        if (token && refresh && storedUser) {
          setAccessToken(token);
          setStoredRefreshToken(refresh);
          setExpiresAt(expires ? parseInt(expires, 10) : 0);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.warn('[SpotifyAuth] Load session error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistSession = useCallback(async (tokens: SpotifyTokens) => {
    const expires = Date.now() + tokens.expiresIn * 1000;
    await Promise.all([
      secureSetItem(STORE_KEYS.accessToken, tokens.accessToken),
      secureSetItem(STORE_KEYS.refreshToken, tokens.refreshToken),
      secureSetItem(STORE_KEYS.expiresAt, String(expires)),
    ]);
    setExpiresAt(expires);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');

    if (!code && !oauthError) return;

    const stripQuery = () => {
      url.search = '';
      window.history.replaceState({}, document.title, url.pathname + url.hash);
    };

    if (oauthError) {
      stripQuery();
      sessionStorage.removeItem(WEB_REDIRECT_STORAGE_KEY);
      setError(`Spotify: ${oauthError}`);
      return;
    }

    const verifier = sessionStorage.getItem(WEB_VERIFIER_STORAGE_KEY);
    if (!verifier) {
      stripQuery();
      sessionStorage.removeItem(WEB_REDIRECT_STORAGE_KEY);
      setError('Sesión de login incompleta. Probá de nuevo.');
      return;
    }

    const authCode = code as string;
    const authVerifier = verifier as string;

    stripQuery();

    const redirectUri =
      sessionStorage.getItem(WEB_REDIRECT_STORAGE_KEY) ?? getSpotifyRedirectUri();

    let finished = false;
    (async () => {
      setIsLoggingIn(true);
      try {
        const tokens = await exchangeCodeForTokens(authCode, authVerifier, redirectUri);
        if (finished) return;
        sessionStorage.removeItem(WEB_VERIFIER_STORAGE_KEY);
        sessionStorage.removeItem(WEB_REDIRECT_STORAGE_KEY);
        await persistSession(tokens);
        const spotifyUser = await getCurrentUser(tokens.accessToken);
        await secureSetItem(STORE_KEYS.user, JSON.stringify(spotifyUser));
        setUser(spotifyUser);
        setAccessToken(tokens.accessToken);
        setStoredRefreshToken(tokens.refreshToken);
        await refreshPkcePair();
      } catch (e: any) {
        if (!finished) {
          console.error('[SpotifyAuth] Web OAuth completion error:', e);
          setError(e?.message ?? 'Error al completar login con Spotify');
        }
      } finally {
        if (!finished) setIsLoggingIn(false);
      }
    })();

    return () => {
      finished = true;
    };
  }, [persistSession, refreshPkcePair]);

  const logout = useCallback(async () => {
    await secureDeleteItems(Object.values(STORE_KEYS));
    setUser(null);
    setAccessToken(null);
    setStoredRefreshToken(null);
    setExpiresAt(0);
    await refreshPkcePair();
  }, [refreshPkcePair]);

  const login = useCallback(async () => {
    setError(null);
    setIsLoggingIn(true);
    const clientId = getSpotifyClientId();
    const redirectUri = getSpotifyRedirectUri();

    try {
      let pair = pkceRef.current;
      if (!pair) {
        await refreshPkcePair();
        pair = pkceRef.current;
      }
      if (!pair) {
        throw new Error('No se pudo preparar el login. Reintentá en un momento.');
      }

      const { verifier, challenge } = pair;

      const authUrl =
        `https://accounts.spotify.com/authorize` +
        `?client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${SCOPES}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${challenge}` +
        `&show_dialog=false`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        sessionStorage.setItem(WEB_VERIFIER_STORAGE_KEY, verifier);
        sessionStorage.setItem(WEB_REDIRECT_STORAGE_KEY, redirectUri);
        pkceRef.current = null;
        void refreshPkcePair();
        window.location.assign(authUrl);
        return;
      }

      void secureSetItem(STORE_KEYS.codeVerifier, verifier);

      // Extract the existing verifier before we do anything else
      const currentVerifier = verifier;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        showInRecents: true,
      });

      if (result.type !== 'success') {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          setError('Login cancelado');
        }
        await refreshPkcePair();
        return;
      }

      const params = new URLSearchParams(result.url.split('?')[1] ?? '');
      const responseCode = params.get('code');
      const errorParam = params.get('error');

      if (errorParam) {
        setError(`Spotify error: ${errorParam}`);
        await refreshPkcePair();
        return;
      }

      if (!responseCode) {
        setError('No se recibió código de autorización');
        await refreshPkcePair();
        return;
      }

      const exactStoredVerifier = await secureGetItem(STORE_KEYS.codeVerifier);
      const tokens = await exchangeCodeForTokens(
        responseCode,
        exactStoredVerifier ?? currentVerifier,
        redirectUri
      );
      await persistSession(tokens);

      const spotifyUser = await getCurrentUser(tokens.accessToken);
      await secureSetItem(STORE_KEYS.user, JSON.stringify(spotifyUser));

      setUser(spotifyUser);
      setAccessToken(tokens.accessToken);
      setStoredRefreshToken(tokens.refreshToken);
      await refreshPkcePair();
    } catch (e: any) {
      console.error('[SpotifyAuth] Login error:', e);
      setError(e?.message ?? 'Error inesperado durante login');
    } finally {
      setIsLoggingIn(false);
    }
  }, [persistSession, refreshPkcePair]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!storedRefreshToken) return null;
    const isExpired = Date.now() >= expiresAt - 60_000;
    if (!isExpired && accessToken) return accessToken;

    try {
      const tokens = await refreshAccessToken(storedRefreshToken);
      await persistSession(tokens);
      setAccessToken(tokens.accessToken);
      setStoredRefreshToken(tokens.refreshToken);
      return tokens.accessToken;
    } catch (e) {
      console.error('[SpotifyAuth] Refresh failed, logging out:', e);
      await logout();
      return null;
    }
  }, [accessToken, storedRefreshToken, expiresAt, logout, persistSession]);

  const value = useMemo<SpotifyAuthState>(
    () => ({
      user,
      accessToken,
      isLoading,
      isLoggingIn,
      error,
      login,
      logout,
      getValidToken,
    }),
    [user, accessToken, isLoading, isLoggingIn, error, login, logout, getValidToken]
  );

  return (
    <SpotifyAuthContext.Provider value={value}>{children}</SpotifyAuthContext.Provider>
  );
}

export function useSpotifyAuth(): SpotifyAuthState {
  const ctx = useContext(SpotifyAuthContext);
  if (!ctx) throw new Error('useSpotifyAuth must be used within SpotifyAuthProvider');
  return ctx;
}
