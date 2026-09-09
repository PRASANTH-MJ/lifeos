import * as Crypto from 'expo-crypto';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { webDb } from '@/db/webDb';
import { pushLocalRow, recordDeleteBeforeRemoving } from '@/modules/sync/syncEngine.web';

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

type GoalContributionRow = { id: number; goal_id: number; amount: number; date: string; created_at: string };

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

/** Mirrors db/schema.ts's `CHECK (target_amount > 0)` on finance_goals, which IndexedDB has no
 * equivalent for — throws so an invalid write fails loudly on web exactly like SQLite would. */
function assertValidTargetAmount(targetAmount: number): void {
  if (!(targetAmount > 0)) {
    throw new Error('target_amount must be greater than 0');
  }
}

/**
 * Web build of useFinanceGoals.ts — same exported shape, reactive via Dexie's useLiveQuery
 * instead of expo-router's useFocusEffect: a write from any tab (or the sync engine's merge)
 * flows into every mounted instance automatically.
 */
export function useFinanceGoals() {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_goals.toArray()) as GoalRow[];
    return [...all].sort((a, b) => {
      if (a.is_closed !== b.is_closed) return a.is_closed - b.is_closed; // is_closed ASC
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0; // created_at ASC
    });
  }, []);

  const loading = rows === undefined;
  const goals = (rows ?? []).map(toGoal);

  const refresh = useCallback(async () => {
    // No-op: useLiveQuery already re-runs on every underlying write, across every tab.
  }, []);

  const addGoal = useCallback(
    async (values: { name: string; icon?: string; color?: string; targetAmount: number; targetDate?: string | null }) => {
      assertValidTargetAmount(values.targetAmount);
      const now = new Date().toISOString();
      const id = await webDb.finance_goals.add({
        name: values.name,
        icon: values.icon ?? 'flag',
        color: values.color ?? '#3D8BFF',
        target_amount: values.targetAmount,
        target_date: values.targetDate ?? null,
        current_amount: 0,
        is_closed: 0,
        created_at: now,
        updated_at: now,
        sync_id: Crypto.randomUUID(),
      } as never);
      await pushLocalRow('finance_goals', id as number);
    },
    []
  );

  const editGoal = useCallback(
    async (id: string, values: Partial<{ name: string; color: string; targetAmount: number; targetDate: string | null }>) => {
      const updates: Record<string, unknown> = {};
      if (values.name !== undefined) updates.name = values.name;
      if (values.color !== undefined) updates.color = values.color;
      if (values.targetAmount !== undefined) {
        assertValidTargetAmount(values.targetAmount);
        updates.target_amount = values.targetAmount;
      }
      if (values.targetDate !== undefined) updates.target_date = values.targetDate;
      if (Object.keys(updates).length === 0) return;
      updates.updated_at = new Date().toISOString();
      await webDb.finance_goals.update(Number(id), updates as never);
      await pushLocalRow('finance_goals', Number(id));
    },
    []
  );

  const closeGoal = useCallback(async (id: string, isClosed: boolean) => {
    await webDb.finance_goals.update(Number(id), { is_closed: isClosed ? 1 : 0, updated_at: new Date().toISOString() } as never);
    await pushLocalRow('finance_goals', Number(id));
  }, []);

  const removeGoal = useCallback(async (id: string) => {
    const goalId = Number(id);
    // Replaces `finance_goal_contributions.goal_id REFERENCES finance_goals(id) ON DELETE
    // CASCADE` (db/schema.ts) — IndexedDB has no FK cascade, so every contribution row must be
    // explicitly tombstoned/deleted here or it's orphaned forever.
    const contributions = (await webDb.finance_goal_contributions.where('goal_id').equals(goalId).toArray()) as {
      id: number;
    }[];
    for (const contribution of contributions) {
      await recordDeleteBeforeRemoving('finance_goal_contributions', contribution.id);
      await webDb.finance_goal_contributions.delete(contribution.id);
    }

    await recordDeleteBeforeRemoving('finance_goals', goalId);
    await webDb.finance_goals.delete(goalId);
  }, []);

  return { goals, loading, refresh, addGoal, editGoal, closeGoal, removeGoal };
}

/**
 * Web build of useGoalContributions.ts — same exported shape, reactive via useLiveQuery.
 */
export function useGoalContributions(goalId: string) {
  const rows = useLiveQuery(async () => {
    const all = (await webDb.finance_goal_contributions.toArray()) as GoalContributionRow[];
    return all
      .filter((r) => r.goal_id === Number(goalId))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date > b.date ? -1 : 1; // date DESC
        return a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0; // created_at DESC
      });
  }, [goalId]);

  const loading = rows === undefined;
  const contributions: GoalContribution[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    goal_id: String(r.goal_id),
    amount: r.amount,
    date: r.date,
    created_at: r.created_at,
  }));

  const addContribution = useCallback(
    async (amount: number, date: string) => {
      const now = new Date().toISOString();
      let contributionId!: number;
      // Replaces SQL trigger trg_finance_goal_contribution_insert (db/schema.ts): the insert's
      // effect on finance_goals.current_amount is applied explicitly, in the same transaction.
      await webDb.transaction('rw', [webDb.finance_goal_contributions, webDb.finance_goals], async () => {
        contributionId = (await webDb.finance_goal_contributions.add({
          goal_id: Number(goalId),
          amount,
          date,
          created_at: now,
          updated_at: now,
          sync_id: Crypto.randomUUID(),
        } as never)) as number;

        const goal = (await webDb.finance_goals.get(Number(goalId))) as GoalRow | undefined;
        if (goal) {
          await webDb.finance_goals.update(Number(goalId), {
            current_amount: goal.current_amount + amount,
            updated_at: now,
          } as never);
        }
      });

      await pushLocalRow('finance_goal_contributions', contributionId);
      // The insert trigger recomputes finance_goals.current_amount directly — push the parent
      // goal too so the recalculated total syncs.
      await pushLocalRow('finance_goals', Number(goalId));
    },
    [goalId]
  );

  const removeContribution = useCallback(
    async (id: string) => {
      await recordDeleteBeforeRemoving('finance_goal_contributions', Number(id));

      // Replaces SQL trigger trg_finance_goal_contribution_delete (db/schema.ts): the delete's
      // effect on finance_goals.current_amount is applied explicitly, in the same transaction.
      await webDb.transaction('rw', [webDb.finance_goal_contributions, webDb.finance_goals], async () => {
        const contribution = (await webDb.finance_goal_contributions.get(Number(id))) as GoalContributionRow | undefined;
        await webDb.finance_goal_contributions.delete(Number(id));
        if (contribution) {
          const goal = (await webDb.finance_goals.get(contribution.goal_id)) as GoalRow | undefined;
          if (goal) {
            await webDb.finance_goals.update(contribution.goal_id, {
              current_amount: goal.current_amount - contribution.amount,
              updated_at: new Date().toISOString(),
            } as never);
          }
        }
      });

      // The delete trigger recomputes finance_goals.current_amount — push the parent goal too.
      await pushLocalRow('finance_goals', Number(goalId));
    },
    [goalId]
  );

  return { contributions, loading, addContribution, removeContribution };
}
