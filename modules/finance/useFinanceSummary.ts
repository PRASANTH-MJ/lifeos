import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { fetchSummary, type FinanceSummary } from './api';

export function useFinanceSummary(start?: string, end?: string) {
  const { token } = useAuth();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSummary(token, { start, end });
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [token, start, end]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { summary, loading, refresh };
}
