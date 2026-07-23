export type TimerLog = {
  id: number;
  label: string | null;
  habit_id: number | null;
  duration_seconds: number;
  completed_at: string;
};
