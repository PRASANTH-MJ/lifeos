/** Club Habits & Tasks (v1) — a shared, club-scoped mirror of the personal habits/tasks modules
 * (see modules/habits/types.ts, modules/tasks/types.ts) rather than inventing a new taxonomy.
 * Deliberately smaller than the personal models: only 'daily'/'weekly' recurrence (no
 * monthly/periodic), no tracking-type variety (a club habit/recurring task is always a plain
 * yes/no check-in) — enough to track something together without over-engineering v1. */
export type ClubRecurrence = 'daily' | 'weekly';

export type ClubHabit = {
  id: string;
  clubId: string;
  title: string;
  recurrence: ClubRecurrence;
  /** 0=Sun..6=Sat — only meaningful when recurrence is 'weekly', same convention as
   * modules/habits/types.ts's target_days. */
  targetDays: number[];
  createdBy: string;
  /** Retired from the active list without losing its checkins/streak history — same
   * archive-don't-delete pattern as the personal habits module's own `archived` column (see
   * modules/habits/types.ts). Defaults to false for any habit created before this field existed. */
  archived: boolean;
};

export type ClubTask = {
  id: string;
  clubId: string;
  title: string;
  /** null = open to any member; set = only that member (or a club admin/sub-admin) may complete
   * it, matching functions/index.js's toggleClubTaskComplete gating. */
  assignedTo: string | null;
  /** A lib/date dateKey ("YYYY-MM-DD"), or null for no due date — only meaningful for a one-off
   * task (recurrence null). */
  dueDate: string | null;
  /** null = one-off task (uses completed/completedBy/completedAt below); 'daily'/'weekly' = a
   * recurring club task, whose per-day state lives in its own `checkins` subcollection instead —
   * one task model with an optional recurrence field, same as modules/tasks' is_recurring split. */
  recurrence: ClubRecurrence | null;
  recurrenceDays: number[];
  createdBy: string;
  completed: boolean;
  completedBy: string | null;
  completedAtMs: number | null;
  /** Same archive-don't-delete pattern as ClubHabit.archived above — most useful for a completed
   * one-off task, which otherwise sits in the shared list (struck through) forever with no way to
   * clear it out short of deleting it outright. */
  archived: boolean;
};

/** One member's check-in for one day, on either a club habit or a recurring club task — the
 * `checkins/{uid}_{dateKey}` subcollection shape shared by both (see functions/index.js's
 * toggleClubHabitCheckin/toggleClubTaskComplete). */
export type ClubCheckin = {
  uid: string;
  dateKey: string;
};
