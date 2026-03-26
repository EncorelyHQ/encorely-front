import { useState, useCallback, useEffect } from 'react';
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
};

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

const redirectUri = getSpotifyRedirectUri();

console.log('[Encorely] 🚨 URI EXACTA — agrega en Spotify Dashboard:', redirectUri);

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

export function useSpotifyAuth(): SpotifyAuthState {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [storedRefreshToken, setStoredRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const persistSession = async (tokens: SpotifyTokens) => {
    const expires = Date.now() + tokens.expiresIn * 1000;
    await Promise.all([
      secureSetItem(STORE_KEYS.accessToken, tokens.accessToken),
      secureSetItem(STORE_KEYS.refreshToken, tokens.refreshToken),
      secureSetItem(STORE_KEYS.expiresAt, String(expires)),
    ]);
    setExpiresAt(expires);
  };

  const logout = useCallback(async () => {
    await secureDeleteItems(Object.values(STORE_KEYS));
    setUser(null);
    setAccessToken(null);
    setStoredRefreshToken(null);
    setExpiresAt(0);
  }, []);

  const login = useCallback(async () => {
    setError(null);
    setIsLoggingIn(true);
    const clientId = getSpotifyClientId();

    try {
      const codeVerifier = await generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      await secureSetItem(STORE_KEYS.codeVerifier, codeVerifier);

      const authUrl =
        `https://accounts.spotify.com/authorize` +
        `?client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${SCOPES}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}` +
        `&show_dialog=false`;

      console.log('[SpotifyAuth] redirect_uri enviado:', redirectUri);
      console.log('[SpotifyAuth] Auth URL COMPLETO:\n', authUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
        showInRecents: true,
      });

      console.log('[SpotifyAuth] Browser result type:', result.type);

      if (result.type !== 'success') {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          setError('Login cancelado');
        }
        return;
      }

      const url = result.url;
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const code = params.get('code');
      const errorParam = params.get('error');

      if (errorParam) {
        setError(`Spotify error: ${errorParam}`);
        return;
      }

      if (!code) {
        setError('No se recibió código de autorización');
        return;
      }

      const storedVerifier =
        (await secureGetItem(STORE_KEYS.codeVerifier)) ?? codeVerifier;
      const tokens = await exchangeCodeForTokens(code, storedVerifier, redirectUri);
      await persistSession(tokens);

      const spotifyUser = await getCurrentUser(tokens.accessToken);
      await secureSetItem(STORE_KEYS.user, JSON.stringify(spotifyUser));

      setUser(spotifyUser);
      setAccessToken(tokens.accessToken);
      setStoredRefreshToken(tokens.refreshToken);

      console.log('[SpotifyAuth] ✅ Access token OK:', tokens.accessToken.slice(0, 20) + '...');
    } catch (e: any) {
      console.error('[SpotifyAuth] Login error:', e);
      setError(e?.message ?? 'Error inesperado durante login');
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!storedRefreshToken) return null;
    const isExpired = Date.now() >= expiresAt - 60_000;
    if (!isExpired && accessToken) return accessToken;

    try {
      console.log('[SpotifyAuth] Refreshing token...');
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
  }, [accessToken, storedRefreshToken, expiresAt, logout]);

  return { user, accessToken, isLoading, isLoggingIn, error, login, logout, getValidToken };
}
