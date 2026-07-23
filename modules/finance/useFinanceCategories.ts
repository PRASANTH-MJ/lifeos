import { useEffect, useState } from 'react';

import { useAuth } from '@/modules/auth';
import { fetchCategories } from './api';
import type { Category } from './types';

export function useFinanceCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { categories: rows } = await fetchCategories(token);
      setCategories(rows);
      setLoading(false);
    })();
  }, [token]);

  return { categories, loading };
}
