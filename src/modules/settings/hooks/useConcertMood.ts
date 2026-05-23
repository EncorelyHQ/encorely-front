import { useCallback, useEffect, useState } from 'react';
import { ConcertMood } from '@/clients/encorely/types';
import { settingsService } from '@/modules/settings/services/settingsService';
import { useEncorelyAuth } from '@/modules/auth/hooks/useEncorelyAuth';
import {
  concertMoodToLabel,
  profileMoodToConcertMood,
} from '@/modules/auth/utils/mapMood';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export function useConcertMood() {
  const { userId, profile, refreshProfile } = useEncorelyAuth();
  const [mood, setMood] = useState<ConcertMood>(ConcertMood.Chill);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.mood) {
      setMood(profileMoodToConcertMood(profile.mood));
    }
  }, [profile?.mood]);

  const updateMood = useCallback(
    async (next: ConcertMood) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      try {
        await settingsService.updateMood({ userId, mood: next });
        setMood(next);
        await refreshProfile();
      } catch (e) {
        setError(getApiErrorMessage(e));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, refreshProfile]
  );

  return {
    mood,
    moodLabel: concertMoodToLabel(mood),
    updateMood,
    saving,
    error,
  };
}
