import { useState, useCallback, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {
  exchangeCodeForTokens,
  refreshAccessToken,
  getCurrentUser,
  SpotifyUser,
  SpotifyTokens,
} from '../services/spotifyService';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID: string =
  (Constants.expoConfig?.extra?.spotifyClientId as string) ?? '';

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

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

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

// ─── Redirect URI ─────────────────────────────────────────────────────────────
// HARDCODED para desarrollo con tunnel, para asegurar MATCH EXACTO
// Si el tunnel cambia, hay que cambiarlo aquí.
const redirectUri = 'exp://3abvrlm-anonymous-8081.exp.direct';

console.log('[Encorely] 🚨 URI EXACTA — agrega en Spotify Dashboard:', redirectUri);

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpotifyAuth(): SpotifyAuthState {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [storedRefreshToken, setStoredRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load session on mount ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [token, refresh, expires, storedUser] = await Promise.all([
          SecureStore.getItemAsync(STORE_KEYS.accessToken),
          SecureStore.getItemAsync(STORE_KEYS.refreshToken),
          SecureStore.getItemAsync(STORE_KEYS.expiresAt),
          SecureStore.getItemAsync(STORE_KEYS.user),
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

  // ── Persist helpers ───────────────────────────────────────────────────────
  const persistSession = async (tokens: SpotifyTokens) => {
    const expires = Date.now() + tokens.expiresIn * 1000;
    await Promise.all([
      SecureStore.setItemAsync(STORE_KEYS.accessToken, tokens.accessToken),
      SecureStore.setItemAsync(STORE_KEYS.refreshToken, tokens.refreshToken),
      SecureStore.setItemAsync(STORE_KEYS.expiresAt, String(expires)),
    ]);
    setExpiresAt(expires);
  };

  // ── Login — manual PKCE OAuth via WebBrowser ──────────────────────────────
  const login = useCallback(async () => {
    setError(null);
    setIsLoggingIn(true);

    try {
      // 1. Generate PKCE pair
      const codeVerifier = await generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      await SecureStore.setItemAsync(STORE_KEYS.codeVerifier, codeVerifier);

      // 2. Build Spotify authorization URL
      const authUrl =
        `https://accounts.spotify.com/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${SCOPES}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}` +
        `&show_dialog=false`;

      console.log('[SpotifyAuth] redirect_uri enviado:', redirectUri);
      console.log('[SpotifyAuth] Auth URL COMPLETO:\n', authUrl);


      // 3. Open browser — returns when user completes / cancels
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

      // 4. Parse code from redirect URL
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

      // 5. Exchange code for tokens
      const storedVerifier =
        (await SecureStore.getItemAsync(STORE_KEYS.codeVerifier)) ?? codeVerifier;
      const tokens = await exchangeCodeForTokens(code, storedVerifier, redirectUri);
      await persistSession(tokens);

      // 6. Get user profile
      const spotifyUser = await getCurrentUser(tokens.accessToken);
      await SecureStore.setItemAsync(STORE_KEYS.user, JSON.stringify(spotifyUser));

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

  // ── Auto-refresh ──────────────────────────────────────────────────────────
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
  }, [accessToken, storedRefreshToken, expiresAt]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await Promise.all(Object.values(STORE_KEYS).map((k) => SecureStore.deleteItemAsync(k)));
    setUser(null);
    setAccessToken(null);
    setStoredRefreshToken(null);
    setExpiresAt(0);
  }, []);

  return { user, accessToken, isLoading, isLoggingIn, error, login, logout, getValidToken };
}
