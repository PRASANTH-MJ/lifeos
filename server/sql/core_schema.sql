-- LifeOS — Supabase schema for everything that used to be on-device only
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query),
-- in the SAME project as users_schema.sql and finance_schema.sql.
--
-- Why: habits/tasks/journal/etc previously lived only in each device's local
-- SQLite file (db/schema.ts) — invisible to any other device, and lost if the
-- app was ever uninstalled. This migrates every one of those tables into the
-- same shared Supabase project already used for accounts and Finance, so a
-- user's data follows them across web and mobile and can't be lost to a
-- single device failing.
--
-- Access model: identical to the other two schema files — every table here
-- is reached ONLY through the LifeOS Express backend, using the service-role
-- key. RLS is enabled with NO policies (default-deny); the backend scopes
-- every query to req.userId from the verified app JWT.
--
-- Naming note: the app's local "categories" table (shared tags for Habits +
-- Tasks) is renamed here to `tag_categories` — Supabase already has its own
-- `categories` table for Finance's income/expense categories, and the two
-- are unrelated.
--
-- Ordering note: tables that reference another table (habits -> tag_categories,
-- habit_logs -> habits, tasks -> tag_categories + itself, task_completions ->
-- tasks, timer_logs -> habits) are created after what they reference.

create extension if not exists "pgcrypto";

-- === tag_categories (habit/task tags — was "categories" locally) ===========
create table if not exists tag_categories (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  name text not null,
  icon text not null,
  color text not null,
  applies_to text not null check (applies_to in ('habit', 'task', 'both')) default 'both',
  created_at timestamptz not null default now()
);
create index if not exists idx_tag_categories_user_id on tag_categories(user_id);
alter table tag_categories enable row level security;

-- === habits ==================================================================
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  name text not null,
  icon text not null default 'checkmark-circle',
  category_id uuid references tag_categories(id) on delete set null,
  tracking_type text not null default 'yesno' check (tracking_type in ('yesno', 'numeric', 'timer', 'checklist')),
  target_value numeric,
  target_unit text,
  target_comparator text not null default 'at_least' check (target_comparator in ('at_least', 'at_most', 'exactly')),
  checklist_items text not null default '[]',
  checklist_success_mode text not null default 'all' check (checklist_success_mode in ('all', 'custom')),
  checklist_min_count integer not null default 0,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'periodic')),
  target_days text not null default '[]',
  period_target_count integer,
  period_length_days integer,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_habits_user_id on habits(user_id);
alter table habits enable row level security;

-- === habit_logs ===============================================================
create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  status text not null default 'done' check (status in ('done', 'fail', 'skip')),
  value numeric,
  checklist_checked text,
  note text,
  completed_at timestamptz not null default now(),
  unique (habit_id, date)
);
create index if not exists idx_habit_logs_habit_id on habit_logs(habit_id);
create index if not exists idx_habit_logs_user_id on habit_logs(user_id);
alter table habit_logs enable row level security;

-- === tasks (subtasks are just rows with parent_task_id set) =================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  title text not null,
  notes text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  category_id uuid references tag_categories(id) on delete set null,
  important boolean not null default false,
  due_date date,
  due_time text,
  completed_at timestamptz,
  parent_task_id uuid references tasks(id) on delete cascade,
  sort_order integer not null default 0,
  is_recurring boolean not null default false,
  recurrence_frequency text check (recurrence_frequency in ('daily', 'weekly', 'monthly', 'periodic')),
  recurrence_days text not null default '[]',
  period_target_count integer,
  period_length_days integer,
  reminder_offset_minutes integer,
  alarm_enabled boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_user_id on tasks(user_id);
create index if not exists idx_tasks_parent on tasks(parent_task_id);
alter table tasks enable row level security;

-- === task_completions =========================================================
create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  task_id uuid not null references tasks(id) on delete cascade,
  date date not null,
  status text not null default 'done' check (status in ('done', 'fail', 'skip')),
  completed_at timestamptz not null default now(),
  unique (task_id, date)
);
create index if not exists idx_task_completions_task_id on task_completions(task_id);
alter table task_completions enable row level security;

-- === journal_entries ==========================================================
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  body text not null,
  mood text,
  prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_journal_entries_user_id on journal_entries(user_id);
alter table journal_entries enable row level security;

-- === calendar_events ===========================================================
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  title text not null,
  notes text,
  date date not null,
  start_time text,
  end_time text,
  created_at timestamptz not null default now()
);
create index if not exists idx_calendar_events_user_id on calendar_events(user_id);
create index if not exists idx_calendar_events_date on calendar_events(date);
alter table calendar_events enable row level security;

-- === meditation_logs ===========================================================
create table if not exists meditation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  session_key text not null,
  duration_seconds integer not null,
  completed_at timestamptz not null default now()
);
create index if not exists idx_meditation_logs_user_id on meditation_logs(user_id);
alter table meditation_logs enable row level security;

-- === breathing_logs ============================================================
create table if not exists breathing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  pattern_key text not null,
  duration_seconds integer not null,
  cycles integer not null,
  completed_at timestamptz not null default now()
);
create index if not exists idx_breathing_logs_user_id on breathing_logs(user_id);
alter table breathing_logs enable row level security;

-- === affirmations ==============================================================
-- Each user gets their own 15 seeded rows (app logic, on first signup/fetch)
-- since these can be favorited/edited per-user, unlike Finance's categories.
create table if not exists affirmations (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  text text not null,
  is_favorite boolean not null default false,
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_affirmations_user_id on affirmations(user_id);
alter table affirmations enable row level security;

-- === food_logs ==================================================================
create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  description text not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  calories integer not null,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  date date not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_food_logs_user_id on food_logs(user_id);
create index if not exists idx_food_logs_date on food_logs(date);
alter table food_logs enable row level security;

-- === mind_training_logs =========================================================
create table if not exists mind_training_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  exercise_key text not null,
  score numeric not null,
  completed_at timestamptz not null default now()
);
create index if not exists idx_mind_training_logs_user_id on mind_training_logs(user_id);
alter table mind_training_logs enable row level security;

-- === workout_preferences (one row per user, was one row per device) ==========
create table if not exists workout_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null unique,
  goal text not null default 'general',
  equipment text not null default '[]',
  time_minutes integer not null default 30,
  updated_at timestamptz not null default now()
);
alter table workout_preferences enable row level security;

-- === workout_logs ================================================================
create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  workout_key text not null,
  completed_at timestamptz not null default now()
);
create index if not exists idx_workout_logs_user_id on workout_logs(user_id);
alter table workout_logs enable row level security;

-- === timer_logs ===================================================================
create table if not exists timer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  label text,
  habit_id uuid references habits(id) on delete set null,
  duration_seconds integer not null,
  completed_at timestamptz not null default now()
);
create index if not exists idx_timer_logs_user_id on timer_logs(user_id);
alter table timer_logs enable row level security;

-- === app_settings (one row per user, was one row per device) ==================
create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null unique,
  time_format text not null default '24h' check (time_format in ('12h', '24h')),
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- === shopping_items ================================================================
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null,
  name text not null,
  quantity text,
  checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_shopping_items_user_id on shopping_items(user_id);
alter table shopping_items enable row level security;

-- === finance_budgets (was local; belongs with Finance, one row per user) =====
create table if not exists finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null unique,
  weekly_budget numeric,
  monthly_budget numeric,
  updated_at timestamptz not null default now()
);
alter table finance_budgets enable row level security;
