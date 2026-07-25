import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Goal, GoalContribution } from './types';

type GoalRow = {
  id: number;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  target_date: string | null;
  current_amount: number;
  is_closed: number;
  created_at: string;
};

function toGoal(row: GoalRow): Goal {
  return {
    id: String(row.id),
    name: row.name,
    icon: row.icon,
    color: row.color,
    target_amount: row.target_amount,
    target_date: row.target_date,
    current_amount: row.current_amount,
    is_closed: !!row.is_closed,
    created_at: row.created_at,
  };
}

export function useFinanceGoals() {
  const db = useSQLiteContext();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<GoalRow>('SELECT * FROM finance_goals ORDER BY is_closed ASC, created_at ASC');
      setGoals(rows.map(toGoal));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addGoal = useCallback(
    async (values: { name: string; icon?: string; color?: string; targetAmount: number; targetDate?: string | null }) => {
      await db.runAsync(
        'INSERT INTO finance_goals (name, icon, color, target_amount, target_date, current_amount, is_closed, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)',
        [values.name, values.icon ?? 'flag', values.color ?? '#3D8BFF', values.targetAmount, values.targetDate ?? null, new Date().toISOString()]
      );
      await refresh();
    },
    [db, refresh]
  );

  const closeGoal = useCallback(
    async (id: string, isClosed: boolean) => {
      await db.runAsync('UPDATE finance_goals SET is_closed = ? WHERE id = ?', [isClosed ? 1 : 0, Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_goals WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { goals, loading, refresh, addGoal, closeGoal, removeGoal };
}

export function useGoalContributions(goalId: string) {
  const db = useSQLiteContext();
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await db.getAllAsync<{ id: number; goal_id: number; amount: number; date: string; created_at: string }>(
        'SELECT * FROM finance_goal_contributions WHERE goal_id = ? ORDER BY date DESC, created_at DESC',
        [Number(goalId)]
      );
      setContributions(rows.map((r) => ({ id: String(r.id), goal_id: String(r.goal_id), amount: r.amount, date: r.date, created_at: r.created_at })));
    } finally {
      setLoading(false);
    }
  }, [db, goalId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const addContribution = useCallback(
    async (amount: number, date: string) => {
      await db.runAsync('INSERT INTO finance_goal_contributions (goal_id, amount, date, created_at) VALUES (?, ?, ?, ?)', [
        Number(goalId),
        amount,
        date,
        new Date().toISOString(),
      ]);
      await refresh();
    },
    [db, goalId, refresh]
  );

  const removeContribution = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM finance_goal_contributions WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { contributions, loading, addContribution, removeContribution };
}
