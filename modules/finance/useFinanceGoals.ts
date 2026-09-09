import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync';

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
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO finance_goals (name, icon, color, target_amount, target_date, current_amount, is_closed, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)',
        [values.name, values.icon ?? 'flag', values.color ?? '#3D8BFF', values.targetAmount, values.targetDate ?? null, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'finance_goals', result.lastInsertRowId);
      await refresh();
    },
    [db, refresh]
  );

  const editGoal = useCallback(
    async (id: string, values: Partial<{ name: string; color: string; targetAmount: number; targetDate: string | null }>) => {
      const updates: string[] = [];
      const params: (string | number | null)[] = [];
      if (values.name !== undefined) {
        updates.push('name = ?');
        params.push(values.name);
      }
      if (values.color !== undefined) {
        updates.push('color = ?');
        params.push(values.color);
      }
      if (values.targetAmount !== undefined) {
        updates.push('target_amount = ?');
        params.push(values.targetAmount);
      }
      if (values.targetDate !== undefined) {
        updates.push('target_date = ?');
        params.push(values.targetDate);
      }
      if (updates.length === 0) return;
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(Number(id));
      await db.runAsync(`UPDATE finance_goals SET ${updates.join(', ')} WHERE id = ?`, params);
      await pushLocalRow(db, 'finance_goals', Number(id));
      await refresh();
    },
    [db, refresh]
  );

  const closeGoal = useCallback(
    async (id: string, isClosed: boolean) => {
      await db.runAsync('UPDATE finance_goals SET is_closed = ?, updated_at = ? WHERE id = ?', [
        isClosed ? 1 : 0,
        new Date().toISOString(),
        Number(id),
      ]);
      await pushLocalRow(db, 'finance_goals', Number(id));
      await refresh();
    },
    [db, refresh]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      // finance_goal_contributions.goal_id is ON DELETE CASCADE — tombstone those rows before
      // deleting the goal, or other devices never learn the cascaded contributions were removed.
      const contributionRows = await db.getAllAsync<{ id: number }>('SELECT id FROM finance_goal_contributions WHERE goal_id = ?', [
        Number(id),
      ]);
      for (const row of contributionRows) {
        await recordDeleteBeforeRemoving(db, 'finance_goal_contributions', row.id);
      }
      await recordDeleteBeforeRemoving(db, 'finance_goals', Number(id));
      await db.runAsync('DELETE FROM finance_goals WHERE id = ?', [Number(id)]);
      await refresh();
    },
    [db, refresh]
  );

  return { goals, loading, refresh, addGoal, editGoal, closeGoal, removeGoal };
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
      const now = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO finance_goal_contributions (goal_id, amount, date, created_at, updated_at, sync_id) VALUES (?, ?, ?, ?, ?, ?)',
        [Number(goalId), amount, date, now, now, Crypto.randomUUID()]
      );
      await pushLocalRow(db, 'finance_goal_contributions', result.lastInsertRowId);
      // The insert trigger recomputes finance_goals.current_amount directly via SQL — push the
      // parent goal too so the recalculated total syncs.
      await pushLocalRow(db, 'finance_goals', Number(goalId));
      await refresh();
    },
    [db, goalId, refresh]
  );

  const removeContribution = useCallback(
    async (id: string) => {
      await recordDeleteBeforeRemoving(db, 'finance_goal_contributions', Number(id));
      await db.runAsync('DELETE FROM finance_goal_contributions WHERE id = ?', [Number(id)]);
      // The delete trigger recomputes finance_goals.current_amount — push the parent goal too.
      await pushLocalRow(db, 'finance_goals', Number(goalId));
      await refresh();
    },
    [db, goalId, refresh]
  );

  return { contributions, loading, addContribution, removeContribution };
}
