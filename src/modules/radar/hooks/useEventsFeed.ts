import { useCallback, useEffect, useState } from 'react';
import type { EventFeedItem } from '@/clients/encorely/types';
import { radarService } from '@/modules/radar/services/radarService';
import { getApiErrorMessage } from '@/shared/lib/apiErrorMessage';

export function useEventsFeed() {
  const [events, setEvents] = useState<EventFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await radarService.getEventsFeed();
      setEvents(feed);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, error, reload: load };
}
