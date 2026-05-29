import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { getMe, ApiError, type BackendUser } from '@/clients/api';

/**
 * Carga el perfil del usuario desde el backend (GET /User/me) usando el
 * `backendUserId` guardado tras el login. Devuelve null si aún no hay identidad
 * de backend (p. ej. login solo-Spotify sin haber vinculado, o backend caído).
 */
export function useBackendUser() {
  const { backendUserId } = useAuth();
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!backendUserId) {
      setUser(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setUser(await getMe(backendUserId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  }, [backendUserId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { user, loading, error, reload };
}
