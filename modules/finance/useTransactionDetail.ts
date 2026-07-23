import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { FinanceTransaction } from './types';

export function useTransactionDetail(transactionId: number) {
  const db = useSQLiteContext();
  const [transaction, setTransaction] = useState<FinanceTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const row = await db.getFirstAsync<FinanceTransaction>('SELECT * FROM finance_transactions WHERE id = ?', [
      transactionId,
    ]);
    setTransaction(row);
    setLoading(false);
  }, [db, transactionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateTransaction = useCallback(
    async (values: Partial<Pick<FinanceTransaction, 'amount' | 'category' | 'note'>>) => {
      const keys = Object.keys(values) as (keyof typeof values)[];
      const setClause = keys.map((key) => `${key} = ?`).join(', ');
      await db.runAsync(`UPDATE finance_transactions SET ${setClause} WHERE id = ?`, [
        ...keys.map((key) => values[key] as string | number | null),
        transactionId,
      ]);
      await refresh();
    },
    [db, transactionId, refresh]
  );

  const deleteTransaction = useCallback(async () => {
    await db.runAsync('DELETE FROM finance_transactions WHERE id = ?', [transactionId]);
  }, [db, transactionId]);

  return { transaction, loading, updateTransaction, deleteTransaction, refresh };
}
