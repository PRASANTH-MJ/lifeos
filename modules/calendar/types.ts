export type CalendarEvent = {
  id: number;
  title: string;
  notes: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};
