import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '@/clients/encorely/types';
import { homeService } from '@/modules/home/services/homeService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export function useHomeProfile() {
  const { userId, profile: contextProfile, refreshProfile } = useEncorelyAuth();
  const [profile, setProfile] = useState<UserProfile | null>(contextProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return null;
    setLoading(true);
    setError(null);
    try {
      const me = await homeService.getProfile(userId);
      setProfile(me);
      return me;
    } catch (e) {
      setError(getApiErrorMessage(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (contextProfile) setProfile(contextProfile);
  }, [contextProfile]);

  useEffect(() => {
    if (userId && !contextProfile) void load();
  }, [userId, contextProfile, load]);

  const refresh = useCallback(async () => {
    const me = await refreshProfile();
    if (me) setProfile(me);
    else await load();
  }, [refreshProfile, load]);

  return {
    profile,
    swipeCount: profile?.swipeCount ?? 0,
    loading,
    error,
    refresh,
  };
}
