# LifeOS

A single Expo (iOS + Android + web) app unifying habits, tasks, calendar,
meditation, breathing, mind training, workouts, affirmations, finance,
journaling, food tracking, and a cross-module analytics dashboard. **All**
application data (habits, tasks, journal, finance, everything) stays fully
local-first in on-device SQLite. The one exception is signing in itself —
that uses **Supabase Auth** directly (email + password), so there's no
separate backend server to run or host at all. Supabase only ever sees an
email/password/session — never any habit, task, journal, or finance data.

This app was simplified to this shape for its V1 (friends-and-family) release
after briefly running its own Express + JWT backend with a hand-migrated
Finance module in Supabase — that added a real server to host (on Render) for
no benefit at this scale, so it was removed. See "Architecture" below for
the current shape, and the historical phase notes further down for how each
feature module was originally built (those are all still accurate — this
simplification only touched auth and Finance's storage location).

This repo now implements **all 12 modules from the original spec** (Phases
1–4), a **Phase 5** upgrade to Habits and Tasks (a shared category system;
numeric/timer/checklist habit tracking beyond yes-or-no; daily/weekly/
monthly/periodic frequencies; Done/Fail/Skip status tracking with notes; full
edit flows; recurring tasks; a standalone Timer module), a small **Settings**
module (12h/24h time format) and per-task **Reminder**/**Alarm** notifications
for one-time tasks, and a **Phase 6** upgrade: real email/username + password
accounts backed by a small Express server, a richer Today screen (search,
full month calendar, an added "Recurring Task" filter, Done/Fail/Skip logging
for every task not just recurring ones), and a rebuilt Habit/Task detail
screen (bottom Calendar / Statistics / Edit tabs, real `react-native-svg`
donut + bar charts, streak-challenge badges, inline editing with
Archive/Restart-or-Clear-history/Delete). Nothing is stubbed — see "Possible
follow-ups" for what's intentionally simplified, and "Explicitly out of
scope" for what was never attempted.

## Stack

- Expo SDK 57, TypeScript strict, `expo-router` (file-based routing), with
  `Stack.Protected` gating `(tabs)` vs. `(auth)` based on sign-in state
- `expo-sqlite` (async API) for **all** application data — no in-memory-only
  state, no server, nothing leaves the device except the sign-in itself
- `@supabase/supabase-js` — the one cloud dependency, used only for
  `supabase.auth.*` (email+password sign in/up/out, session persistence,
  auto-refresh). The app never queries a Supabase database table directly.
- `expo-secure-store` — now used as the storage adapter Supabase's client
  persists its session into (Keychain/Keystore on native; falls back to
  `localStorage` on web, which has no real SecureStore implementation at all
  — see Authentication section)
- `react-native-svg` for the Habit/Task detail Statistics tab's donut and bar
  charts — the app's first real vector-drawing dependency (everything before
  it was `View`-based, like `<HeatmapCalendar />`/`<TrendChart />`)
- `expo-notifications` — permission request + `scheduleDailyReminder()`,
  wired to a live toggle on the Meditation screen (not yet persisted across
  app restarts — see Meditation section)
- `expo-audio` for the Meditation session player, bundled local placeholder
  audio (no streaming, fully offline)
- React Context per module for state — no global store
- One shared design system (`theme/`) — colors, spacing, type scale, dark mode

## Getting started

```bash
npm install
npm run ios      # or npm run android
npm run typecheck
```

The app requires signing in (real account via Supabase Auth, not a device
PIN — see Authentication below). Set these two env vars before running it
(e.g. in a `.env` file, or per-profile in `eas.json`/`netlify.toml`):

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your project's anon/public key>
```

Both come from the Supabase dashboard → Settings → API. The anon key is
meant to be public/shipped in an app — never put the `service_role` key
here or anywhere client-side.

In Supabase's dashboard, under Authentication → Providers → Email, turn
**off** "Confirm email" so `supabase.auth.signUp()` immediately returns a
usable session (matches this app's "sign up and you're in" flow) — leaving
it on means a new account can't sign in until it clicks a confirmation link.

## Verified

No iOS Simulator or Android emulator was available in the environment this
was built in, so beyond `tsc --noEmit` and `expo export`, the app was
actually driven end-to-end via the web target (`expo start --web`) in
headless Chrome (Playwright) — real user flows, not just a clean bundle:

- All 13 routes load with zero console errors
- Created a habit through the real form, saw it appear in the list with a
  live streak badge after toggling completion, and confirmed the detail
  screen's heatmap/stats render correctly
- Confirmed the Workout recommendation engine picks a real equipment/time-
  appropriate suggestion (default prefs → "Quick Bodyweight Circuit")
- Played the Reaction Time mini-game to a real scored result (state
  machine + `setTimeout` delay + `Date.now()` timing all correct)
- Confirmed the Affirmations seed migration (15 rows) and day-seeded pick

This surfaced two real bugs on the first pass, both fixed:
1. **Currency stat tiles truncated** (`"US$..."`) because
   `adjustsFontSizeToFit` isn't implemented on react-native-web (it works
   natively on iOS/Android). Fixed by adding `formatCurrencyCompact()`
   (whole-dollar, no cents) for tight stat tiles rather than relying on
   autosize — `modules/finance/types.ts`.
2. **Tapping a habit/task's completion checkbox also navigated to its
   detail screen.** The checkbox was nested inside the same `<Link asChild>`
   that made the whole row tappable; on web that renders a real `<a>`, and
   `stopPropagation()` on the inner press didn't suppress the anchor's
   native navigation. Fixed by restructuring `HabitListItem`/`TaskListItem`
   so the checkbox is a sibling of the `Link`, never nested inside it —
   this also matches how `CalendarMonthGrid`'s day-agenda rows were already
   built. Along the way, also fixed an Expo Router `Slot` warning about
   passing an array `style` to its direct child.

The Phase 5 rebuild (categories, habit tracking types, task recurrence,
Timer) was re-verified the same way after the schema rewrite, since a fresh
browser profile runs the *entire* migration chain (v1→v5) end to end —
created a numeric habit with a custom category, a checklist habit, and a
recurring task; logged each through their status sheets; ran a real Timer
session; and confirmed the habit detail screen's goal/streak/heatmap. That
pass caught one more real bug: **`TaskLogSheet` never closed itself after
Done/Fail/Skip** (unlike `HabitLogSheet`, which does) — tapping a status
left the sheet open over the now-updated row. Fixed by adding the same
save-then-`onClose()` pattern `HabitLogSheet` already used.

Recurring tasks then gained the same "periodic" frequency habits already had
(v6 migration — see the Task Management section), and Settings/Reminder/Alarm
came after that (v7 migration). Re-verifying the reminder/alarm flow caught
the most consequential bug yet: **saving a one-time task with a reminder or
alarm never returned** — `requestNotificationPermissions()` awaits the real
OS permission prompt, and `createTask`/`updateTask` `await`ed the whole
notification-scheduling call before letting the save complete, so the Save
button hung indefinitely whenever that prompt was slow (or, in this headless
test environment, never resolves at all since there's no user to answer it).
Fixed by making notification scheduling fire-and-forget
(`syncTaskNotifications(...).catch(() => {})`) everywhere it's called —
scheduling a reminder is a best-effort side effect and must never gate the
task actually saving to SQLite, which is the real source of truth. This is
the clearest example so far of why re-verifying in a browser (rather than
trusting a clean bundle) matters: `tsc` and a successful `expo export` both
had no way to catch a hang like this.

Getting the web target running at all required two environment fixes,
committed to the project: `metro.config.js` (expo-sqlite's web backend needs
`.wasm` registered as a resolvable asset extension) and installing
`@expo/metro-runtime`, `react-dom`, and `react-native-web`. Native iOS/Android
builds don't need any of this — it's purely for the web-based verification
path used here.

**Phase 6 (auth + Today/detail redesign) verification:** the backend's three
endpoints were curl-tested directly first (signup, duplicate-email 409,
login by email, login by username, wrong-password 401, `/me` with and
without a token) before any client work began. The client side was then
driven the same browser/Playwright way as every prior phase — real signup,
real login, real logout, a full session-persists-across-reload check, and
click-throughs of the new Today search box, the month-calendar modal
(including next-month navigation and picking a date from it), the new
"Recurring Task" filter, and both the Habit and Task detail screens' three
tabs (logging a day from the Calendar tab, reading the Statistics tab's
donut/bar charts and streak badges, editing and saving from the Edit tab,
and Archive/Restart-or-Clear-history/Delete). This surfaced two real bugs,
both fixed:
1. **The auth gate didn't actually gate anything.** The first implementation
   conditionally rendered `<Stack.Screen name="(tabs)" />` vs.
   `<Stack.Screen name="(auth)" />` based on `user`, but Expo Router still
   resolved the literal `/` URL to `(tabs)/index` regardless of which
   `Stack.Screen` elements were mounted — confirmed live by loading a fresh,
   signed-out browser session and landing straight on the Today screen
   instead of Login. Fixed by switching to the framework's actual
   `<Stack.Protected guard={...}>` API (wrapping each screen group), which
   correctly redirects away from a guarded route regardless of how it was
   reached.
2. **`expo-secure-store` has no real web implementation** — its
   `ExpoSecureStore.web.ts` is a literal `export default {}` stub, so calling
   it during the auth-restore effect threw
   `getValueWithKeyAsync is not a function` on web (native iOS/Android are
   unaffected; they use the real Keychain/Keystore backend). Fixed with a
   small `Platform.OS === 'web'` wrapper (`modules/auth/secureStorage.ts`)
   that falls back to `localStorage` only on web.

One further fix worth calling out even though it wasn't a hard crash: the
Playwright script itself (not the app) initially failed to fill the signup
form after clicking through from Login, because Expo Router's web output
leaves the previous screen's `<input>` elements mounted-but-offscreen during
a client-side navigation — `page.locator('input')` matched both screens'
fields. Switched the test to `input:visible` and to navigating directly by
URL for a fresh screen; noted here since it's an instructive gotcha for
anyone else scripting this app's web target, not an app defect.

## Architecture

```
app/                     expo-router routes only
  _layout.tsx            SQLiteProvider + ThemeProvider + AuthProvider +
                          Stack.Protected((tabs) vs (auth)) + notification handler
  (auth)/                 login, signup — reachable only when signed out
  (tabs)/
    _layout.tsx           bottom tabs: Today, Habits, Tasks, Journal, More
    index.tsx             "Today" — week strip + search + month-calendar modal +
                          All/Important/Habits/Task/Recurring-Task filters +
                          Done/Fail/Skip for every task, not just recurring ones
    more.tsx               hub screen linking to Calendar / Meditation / Breathing
    habits/                index, new (create + edit via ?habitId=),
                          [id] (Calendar/Statistics/Edit tabs) — Stack per module
    tasks/                 index (Single/Recurring tabs), new (create + edit via ?taskId=),
                          [id] (Calendar/Statistics/Edit tabs, same structure as habits)
    journal/               index, new, [id]
    calendar/               index (month grid + day agenda), new, [id]     — hidden tab*
    meditation/             index, [sessionKey] (player), timer (freeform) — hidden tab*
    breathing/              index, [patternKey] (animated guide)          — hidden tab*
    affirmations/           index (today's pick + favorites), all, new    — hidden tab*
    finance/                index (monthly summary), new, [id]            — hidden tab*
    food/                   index (daily summary by meal), new            — hidden tab*
    mind-training/          index, [exerciseKey] (one of 3 mini-games)    — hidden tab*
    workout/                index (preferences + today's pick), all, [workoutKey] — hidden tab*
    analytics/              index — the read-only cross-module dashboard  — hidden tab*
    timer/                  index — standalone stopwatch/countdown        — hidden tab*
    settings/               index — time format (12h/24h)                — hidden tab*

    * registered under (tabs) with `href: null` so they're real Stack routes
      reachable from More, without their own tab bar icon — see "Scaling past
      four tabs" below.

theme/                   design tokens + ThemeProvider (light/dark)
db/                       schema migrations (PRAGMA user_version) + useLocalTable<T>()
lib/                      date helpers (YYYY-MM-DD keys, no Date objects passed around;
                          also month-cursor helpers shared by Today/Habit/Task calendars)
components/               shared design-system primitives (Button, Card, TextField,
                          TimeField (12h/24h-aware, AM/PM), Chip, EmptyState,
                          HeatmapCalendar, DonutChart (react-native-svg), RangeChip,
                          Legend, ScreenContainer)
modules/
  auth/                   AuthContext/useAuth (Supabase Auth: signIn/signUp/signOut,
                          session restore via onAuthStateChange), supabaseClient
                          (the one Supabase dependency in the app — auth only),
                          secureStorage (session storage adapter: SecureStore native,
                          localStorage on web)
  categories/             shared category system (icon+color, user-creatable),
                          useCategories, CategoryPicker (used by Habits & Tasks)
  habits/                 types (4 tracking types × 4 frequencies), streak/longest-streak/
                          period-progress calculation, stats (range bounds, status
                          tallies, monthly done-counts, streak-challenge tiers),
                          useHabits/useHabitDetail (+ restartProgress), StreakBadge,
                          HabitListItem, HabitForm (shared by create + inline Edit tab),
                          HabitLogSheet (Done/Fail/Skip)
  tasks/                  types, useTasks (single) / useRecurringTasks, useTaskDetail
                          (+ deleteTask/clearCompletionHistory, streak/longestStreak for
                          recurring tasks reusing habits' streak math), TaskListItem /
                          RecurringTaskListItem, TaskForm (shared by create + inline Edit
                          tab), TaskLogSheet, logOneTimeTask (dual-writes task_completions
                          + tasks.completed_at so one-time tasks get real Done/Fail/Skip
                          without breaking every other completed_at-driven query),
                          PriorityChip, scheduleTaskNotifications (reminder + alarm,
                          one-time tasks only)
  timer/                  useTimerLogs — standalone stopwatch/countdown,
                          optional link into a timer-type habit's log
  settings/               useSettings (single-row upsert, like workout preferences),
                          formatTimeDisplay — the one place time-format math lives
  journal/                types, useJournal/useJournalDetail, MoodPicker, JournalListItem
  calendar/               types, useCalendarDay (merged agenda), useMonthMarkers,
                          useEventDetail, CalendarMonthGrid
  meditation/             session catalog (bundled audio), useMeditationLogs
  breathing/              pattern catalog, useBreathingCycle, useBreathingLogs,
                          BreathingCircle (Animated API)
  affirmations/           useAffirmations (day-seeded pick, favorites, custom)
  finance/                types, accounts/categories/transactions/budgets all local
                          SQLite (finance_accounts/finance_categories/
                          finance_transactions/finance_budgets) with a balance-
                          recalculation trigger on finance_transactions (income/
                          expense/transfer) — useAccounts, useTransactions,
                          useFinanceSummary, useFinanceCategories, useFinanceBudgets,
                          useFinanceWeekSpend, useFinanceDailySpend
  food/                   types, useFoodDay (grouped-by-meal + daily totals)
  mind-training/          exercise catalog, useMindTrainingLogs/useBestScores,
                          games/ReactionGame, games/SequenceGame, games/GoNoGoGame
  workout/                catalog, useWorkoutPreferences (single-row upsert),
                          useWorkoutLogs, recommend() (pure filter/pick function)
  analytics/              useAnalyticsDashboard — the only hook in the app that
                          queries across module tables; owns none of its own
notifications/            handler config, permission request, scheduleDailyReminder(),
                          scheduleOneTimeNotification() (DATE trigger — task reminders/alarms)
assets/audio/             3 generated placeholder ambient WAV loops (see Meditation)
```

**Why this Phase 1 grouping (Habits + Tasks + Journal):** they share the same
infrastructure most heavily — all three are simple CRUD-over-SQLite with a
list/new/detail shape, and Journal reuses the `HeatmapCalendar` built for
Habits. Calendar (needs habits+tasks+events merged), Meditation/Breathing
(need audio + timers), and the rest are architecturally heavier and build on
patterns proven here.

**SQLite over WatermelonDB:** data volume is a single user's habits/tasks/
journal entries — thousands of rows at most. WatermelonDB's sync engine and
reactive layer solve problems (multi-device sync, huge datasets) this app
doesn't have yet. `expo-sqlite` + a small generic hook (`useLocalTable`) keeps
one direct, inspectable persistence path that every future module reuses
without new dependencies.

**Meditation/breathing audio (per your decision):** bundled locally rather
than streamed, to stay fully offline. Meditation ships 3 generated placeholder
ambient tone loops (`assets/audio/*.wav`, ~20s each, looped during playback) —
swap `audioSource` in `modules/meditation/types.ts` for licensed guided-voice
content later; nothing else about the player or schema changes to do that.
Breathing Practice is visual-only (per the original module spec), so it has
no audio dependency at all.

**Why this Phase 2 grouping (Calendar + Meditation + Breathing):** Calendar
was the natural next step since it's a read/aggregate layer over the Habits
and Tasks tables Phase 1 already built — it introduces exactly one new table
(`calendar_events`) and otherwise just queries existing data. Meditation and
Breathing were paired because they share the same session-timer shape (pick
a duration/pattern → run a countdown → log a completed session) and because
Meditation's "reminder" toggle was the first real consumer of the
notification helpers scaffolded (but unused) in Phase 1.

**Scaling past four tabs:** adding 3 more full modules made a 7-icon bottom
tab bar too cramped, so `(tabs)/_layout.tsx` now has 5 tabs — Today, Habits,
Tasks, Journal, and a new **More** hub. Calendar/Meditation/Breathing (and now
Affirmations/Finance/Food) are still registered inside the same `(tabs)`
navigator (so they share its back-stack behavior) but with `href: null`, which
hides them from the tab bar while keeping them reachable via `Link`/
`router.push`. More stays the scalable home for "module #5 and beyond" rather
than the tab bar growing indefinitely.

**Why this Phase 3 grouping (Affirmations + Finance + Food):** all three are
simple "log an entry, see a period summary" modules — no audio, no animation,
no cross-module merging — so they reuse Phase 1/2 patterns directly rather
than introducing new architecture. Mind Training (scored exercises) and
Workout Suggestions (a recommendation engine) both need bespoke interaction
logic that doesn't fit the CRUD-plus-summary shape, so they're deferred.
Finance's monthly summary and Food's daily summary also motivated pulling a
`<StatCard />` out of Finance and into the shared `components/` — the
Analytics Dashboard was going to need one anyway.

**Why this Phase 4 grouping (Mind Training + Workout Suggestions + Analytics
Dashboard), and why last:** Mind Training and Workout Suggestions were
deferred from Phase 3 specifically because they don't fit the CRUD-plus-
summary shape — Mind Training needed three bespoke real-time mini-games
(a reaction-time timer, a Simon-style growing sequence, a go/no-go attention
task), and Workout Suggestions needed an actual recommendation function
(`pickRecommendedWorkout()`) rather than a form. The Analytics Dashboard was
saved for last on purpose: it's explicitly a read-only aggregation layer over
every other module's tables, so building it before Finance/Food/Mind
Training/Workout existed would have meant either leaving trend rows out or
guessing at a shape that might not match. With all 11 feature modules in
place, its 6 trend queries (habit completions, task completions, mood,
combined meditation+breathing minutes, spending, calories) all have real
tables to read from.

**`<TrendChart />`:** a lightweight bar-row component built from plain
`View`s (like `<HeatmapCalendar />` before it) rather than pulling in a
charting library for one screen — consistent with the app's pattern of
reaching for a new dependency only when a `View`-based approach genuinely
can't do the job.

**Phase 5 — Habits & Tasks rebuild, plus Timer:** requested after Phase 4
shipped, to bring Habits and Tasks up to a richer reference design: multiple
habit tracking types (not just yes/no), a real category system, Done/Fail/
Skip status tracking, full edit flows, and recurring tasks. This required
rebuilding (not just extending) the `habits` and `tasks` tables — SQLite
can't `ALTER` a `CHECK` constraint, so both tables are recreated in the v5
migration (`CREATE ... _new`, copy, `DROP`, `RENAME`) rather than
`ALTER TABLE ADD COLUMN`. A few things were deliberately simplified rather
than pixel-matched to the reference design:
- **One scrolling form instead of an animated step-by-step wizard**, for
  both Habit and Task creation — same fields, same order, no navigation
  state machine to build and debug.
- **"Specific days of the year" and a free-form "Repeat every N days"**
  frequency were dropped — `daily` / `weekly` / `monthly` / `periodic`
  ("X times per Y days") cover the common cases without a 5th and 6th
  branch through every date calculation.
- **No drag-to-reorder** for habits or the category list.
- Task "checklists" reuse the existing subtask mechanism (`parent_task_id`)
  rather than a second, parallel checklist system — a checklist *is* a set
  of subtasks here, on every screen.

**Recurring tasks gained the 4th frequency (v6 migration):** Phase 5
initially shipped recurring tasks with only daily/weekly/monthly — "some days
per period" was still habit-only. Brought up to parity: `tasks` gained
`period_target_count`/`period_length_days` (another CHECK-constraint change,
another table rebuild), `useRecurringTasks`/`useTaskDetail` compute period
progress via the same `computePeriodProgress()` habits already use, and
`RecurringTaskListItem`/the task detail screen show a `2/3`-style progress
badge instead of a streak for periodic tasks — identical to how
`HabitListItem` handles periodic habits. Re-verified in-browser afterward,
which caught one real layout bug: the task form's frequency chip row was
missing `flexWrap: 'wrap'` (present on the habit form's equivalent row since
the start), so going from 3 to 4 frequency options overflowed the screen
width instead of wrapping to a second line. Fixed.

**Phase 6 — real accounts, Today upgrades, Habit/Task detail redesign:**
requested after Phase 5 shipped. Three independent pieces:
- **Authentication** — you explicitly chose "real accounts with a backend"
  over a device-only PIN/biometric lock, so a small separate Express server
  (`server/`) now owns signup/login; the app itself still has zero backend
  dependency for its actual data (habits/tasks/journal/etc. never leave the
  device). See the Authentication section below.
- **Today screen** — a search box and a full month-calendar modal
  (`<CalendarMonthGrid />`, already built for the Calendar tab, reused rather
  than duplicated) sit above the existing week strip; picking any date from
  either updates the same `selectedDate` the rest of the screen already
  keyed off. A 5th filter chip ("Recurring Task") splits what "Tasks" used
  to lump together. The biggest behavior change: one-time tasks now open the
  same Done/Fail/Skip `<TaskLogSheet />` recurring tasks always used, instead
  of toggling `completed_at` directly on tap — see `logOneTimeTask.ts` below
  for how that stays consistent with everywhere else that reads
  `completed_at`.
- **Habit/Task detail redesign** — both detail screens gained a bottom
  Calendar / Statistics / Edit tab bar (a segmented control local to the
  screen, not a second nested `Tabs` navigator). Calendar reuses
  `<CalendarMonthGrid />` again; Statistics adds a Week/Month/Year range
  toggle, a dot-progress row or `<TrendChart />` bar chart depending on
  range, a `<DonutChart />` (the app's first `react-native-svg` component)
  breaking down Done/Fail/Skip, and locked/unlocked 7/30/100-day
  streak-challenge badges; Edit is the existing create form rendered inline
  (see `HabitForm`/`TaskForm` below) instead of navigating to a separate
  screen, plus Archive, "Restart progress"/"Clear completion history", and
  Delete.

**One-time tasks' Done/Fail/Skip without breaking `completed_at`
(`modules/tasks/logOneTimeTask.ts`):** recurring tasks already had a
`task_completions` row per day; one-time tasks only ever had the single
`completed_at` timestamp (done vs. not-done, no fail/skip). Rather than add
a second, parallel status column, `task_completions` turned out to already
have no constraint tying it to recurring tasks — its `UNIQUE(task_id, date)`
works just as well for a one-time task's single due date. The one thing that
needed care: `completed_at` is still what the Tasks tab's sort, the Calendar
tab, and the Analytics dashboard all read directly, so
`logOneTimeTaskStatus()`/`clearOneTimeTaskLog()` dual-write — a `done` log
also sets `completed_at`, a `fail`/`skip`/cleared log unsets it — so the task
disappears from Today the same way it always did on Done, but stays visible
(with a status dot) if marked Fail or Skip instead, which the old plain
toggle couldn't express at all.

**`HabitForm`/`TaskForm` — one form, two call sites:** both the create screen
(`habits/new.tsx`/`tasks/new.tsx`) and each detail screen's new inline Edit
tab need the exact same fields, validation, and chip/checklist UI — only what
happens with the collected values differs (insert vs. update, plus
create-only checklist-row insertion for tasks). Extracting the form body into
`HabitForm`/`TaskForm` (props: optional existing record to prefill from, an
`onSave(values)` callback, a submit label, optional extra actions) meant the
Phase 6 Edit tab added zero duplicated field-editing code.

**Streak-challenge badges and "longest streak" are pure derived data, not new
schema:** `computeLongestStreak()` (`modules/habits/streak.ts`) reuses the
exact due-day-aware walk `computeStreak()` already did, just anchored at
every historical `done` date instead of only today, so a broken streak can
still unlock a badge it once reached. Recurring tasks reuse this unmodified
(`RecurrenceFrequency` and `HabitFrequency` are the same four values), so
`useTaskDetail` computes a task streak with no task-specific streak logic at
all.

## What's built vs. stubbed

### Authentication — built
- **Supabase Auth**, used directly from the client (`@supabase/supabase-js`)
  — no custom backend. Email + password only: `supabase.auth.signUp()`,
  `signInWithPassword()`, `signOut()`. Supabase's own `auth.users` table is
  the only place an account record lives; this app never creates its own
  users table.
- Client: `modules/auth` — `AuthProvider`/`useAuth()` wraps
  `supabase.auth.getSession()` + `onAuthStateChange()` for session restore
  and auto-login on relaunch, a `login`/`signup` screen pair under
  `app/(auth)/`, session persistence via `expo-secure-store` (native) /
  `localStorage` (web) as Supabase's storage adapter.
- Route gating: `app/_layout.tsx` wraps `(tabs)` and `(auth)` in
  `<Stack.Protected guard={...}>` blocks so a signed-out user can only reach
  Login/Signup and a signed-in user can only reach the app.
- Not built: password reset/forgot-password, OAuth/social login, changing
  your password or email from Settings, multi-account switching (dropped in
  the V1 simplification — one signed-in account per device now), syncing any
  actual app data (habits/tasks/finance/etc.) to Supabase — the account is
  purely a sign-in gate, everything else stays on-device. Requires "Confirm
  email" turned off in Supabase's Auth settings for signup to log straight
  in (see Getting Started) — with it on, a new account needs to click an
  emailed confirmation link before it can sign in.

### Categories (shared) — built
- SQLite table: `categories` (name, icon, color, `applies_to`), seeded once
  with 17 built-ins (Meditation, Work, Finance, Health, …) — ordinary
  editable rows, same "seeded but not special" pattern as Affirmations
- `<CategoryPicker />`: a chip grid plus an inline "Create category" bottom
  sheet (name, icon, color), shared verbatim by the Habit and Task forms —
  the only thing distinguishing a "habit category" from a "task category" is
  the `applies_to` filter on the query, not separate code
- Not built: editing or deleting an existing category, reordering

### Timer — built
- SQLite table: `timer_logs` (label, optional `habit_id`, duration) — no
  tables of its own beyond the log; sessions aren't tied to any catalog
- Stopwatch or countdown (5/10/15/20/30 min presets), Start/Pause/Reset;
  on stop, "Just save" or tap a timer-type habit to also log that session's
  minutes as today's value for that habit via the same `upsertLog()` Habit
  Tracker uses
- Not built: lap times, background/lock-screen countdown (the timer only
  runs while the screen is open, like the Meditation and Breathing timers)

### Habit Tracker — built
- SQLite tables: `habits` (category, tracking type, goal, frequency),
  `habit_logs` (per-day `status`: done/fail/skip, plus a numeric `value`,
  `checklist_checked`, and a `note`)
- **4 tracking types**: yes/no, numeric (goal + unit + at-least/at-most/
  exactly), timer (goal minutes), checklist (items + all-or-custom success
  condition)
- **4 frequencies**: every day, specific weekdays, specific days of the
  month, "X times per Y days" (periodic — tracked as period progress, e.g.
  2/3, rather than a day-streak, since there's no fixed due day)
- Screens: list with a type-appropriate quick action (a real toggle for
  yes/no, a status dot opening `<HabitLogSheet />` for the other three) +
  streak or period-progress badge; a single create form
  (`app/(tabs)/habits/new.tsx`); detail screen with a bottom **Calendar /
  Statistics / Edit** tab bar:
  - **Calendar** — current streak, a full month grid (`<CalendarMonthGrid />`,
    dots on logged days), tap any date to log/backfill through the same sheet,
    today's note if one was left
  - **Statistics** — Week/Month/Year toggle; a dot-progress row (week/month)
    or a `<TrendChart />` bar chart of completions per month (year); a
    `<DonutChart />` Done/Fail/Skip breakdown for the selected range; three
    locked/unlocked streak-challenge badges (7/30/100 days, unlocked once
    the *longest-ever* streak reaches that tier, so a since-broken streak
    still counts)
  - **Edit** — the same form as creation, rendered inline (`<HabitForm />`)
    instead of a separate screen, plus **Restart habit progress** (clears all
    logged history so streaks/stats start over, without deleting the habit),
    Archive, and Delete
- Reusable pieces produced: `<StreakBadge />`, `<HeatmapCalendar />`,
  `<HabitLogSheet />` (Done/Fail/Skip + value/checklist + note + reset,
  reused by the Habits list, habit detail, and Today), `<HabitForm />`
  (shared by create + the inline Edit tab), `<DonutChart />`
  (`react-native-svg`, also reused by Task detail), `useLocalTable<T>()`

### Task Management — built
- SQLite tables: `tasks` (category, important flag, due date+time,
  recurrence fields, self-referencing `parent_task_id` for subtasks/
  checklists) and `task_completions` (per-day status for recurring tasks,
  mirroring `habit_logs`)
- **Single vs. Recurring**, as separate tabs on the Tasks screen — a single
  task uses `completed_at` as its source of truth, a recurring task (same 4
  frequencies as habits: daily / specific weekdays / specific days of the
  month / periodic) gets a `task_completions` row per day via
  `<TaskLogSheet />` (Done/Fail/Skip + reset), the same status-tracking shape
  as habits — periodic recurring tasks show `2/3`-style period progress
  instead of a streak, identical to periodic habits. As of Phase 6, one-time
  tasks *also* get real Done/Fail/Skip (not just a done/not-done toggle) by
  writing to `task_completions` too, dual-written with `completed_at` so
  every other `completed_at`-driven query keeps working unchanged — see
  `logOneTimeTask.ts` in the Phase 6 section above.
- Screens: tabbed list, a single create form that toggles between
  single-task fields (due date/time, reminder, alarm) and recurring fields
  (frequency + days) with a switch, detail screen with a bottom **Calendar /
  Statistics / Edit** tab bar mirroring the Habit detail screen:
  - **Calendar** — a full month grid marking every logged date (plus the due
    date itself for one-time tasks); tap any date to log it through the same
    `<TaskLogSheet />`
  - **Statistics** — identical Week/Month/Year toggle, dot row/bar chart, and
    `<DonutChart />` Done/Fail/Skip breakdown as habits; streak-challenge
    badges only appear for recurring tasks (a one-time task has no
    recurrence to build a streak from)
  - **Edit** — the create form rendered inline (`<TaskForm />`), plus the
    Subtasks checklist (one-time tasks only, unchanged from before), Archive,
    **Clear completion history** (task's equivalent of a habit restart —
    wipes logged `task_completions` without deleting the task), and Delete
    (new — tasks previously had no hard-delete path, only archive)
- **Reminder + Alarm** (one-time tasks only, once both a due date and time
  are set): Reminder is an offset chip (at due time / 10 / 30 min / 1 hour /
  1 day before) scheduling one local notification; Alarm is a switch that
  additionally schedules one at the exact due time. Both use
  `scheduleOneTimeNotification()`'s `DATE` trigger, rescheduled on every
  save and cancelled on completion/archive so the OS-level schedule never
  drifts from what's in SQLite. "Alarm" here means a local notification with
  sound, not a true system alarm (no full-screen ringing/vibrate-until-
  dismissed) — that needs native alarm APIs outside Expo's managed workflow.
- Time is entered/displayed via the shared `<TimeField />`, which reads the
  Settings 12h/24h preference — the same due time reads as `18:30` or
  `6:30 PM` depending on that one global setting, everywhere it's shown.
- Reusable piece produced: `<TaskForm />` (shared by create + the inline Edit
  tab, same pattern as `<HabitForm />`)
- Not built: drag-to-reorder subtasks (`sort_order` column exists, unused by
  any UI), multiple reminders per task (one offset at a time), changing a
  task between single and recurring after creation (the Edit tab's switch
  visually toggles but `updateTask()` doesn't persist `is_recurring` itself —
  pre-existing from Phase 5, not something Phase 6 introduced or fixed)

### Settings — built
- SQLite table: `app_settings`, a single upserted row (`time_format`), same
  pattern as Workout's preferences row
- One setting so far: 12-hour (AM/PM) vs. 24-hour time display, applied
  everywhere a time is shown or entered — currently only task due times, but
  `<TimeField />`/`formatTimeDisplay()` are already shared, generic pieces
  any future module can reuse without knowing about Settings' internals
- Not built: anything beyond time format (a currency setting for Finance is
  a natural next addition to this same table)

### Journaling — built
- SQLite table: `journal_entries`
- Screens: searchable list (SQL `LIKE`, parameterized) with a reused
  contribution heatmap, new entry with a rotating prompt + mood picker,
  detail with inline edit and delete
- Not built: tagging beyond mood, entry attachments

### Calendar Management — built
- SQLite table: `calendar_events` (its only owned table — habits/tasks are
  read, never duplicated)
- Screens: month grid (tap a day to select, dots mark days with an event or
  a task due) + day agenda merging events, tasks due, and habits due that day
  (each toggleable inline, tapping through to its own module's detail screen);
  new-event form; event detail with inline edit + delete
- Reusable piece produced: `<CalendarMonthGrid />`
- Not built: recurring events, multi-day events, a "week view"

### Meditation — built
- SQLite table: `meditation_logs`; session catalog (`MEDITATION_SESSIONS`) is
  static content in code, not user data, matching the "content vs. user data"
  split the schema comment calls out
- Screens: session list + weekly-minutes summary + reminder toggle, a player
  screen (looping ambient audio + countdown, logs on natural completion or
  early "End session"), and a freeform timer (no audio, presets 3–20 min)
- Notification reminder is real: toggling it on the Meditation screen calls
  `requestNotificationPermissions()` then `scheduleDailyReminder()` (8:00 PM
  daily) using the exact helpers scaffolded in Phase 1
- Known simplification: the reminder toggle's on/off state lives in component
  state, not persisted — it resets to "off" on app restart even though the
  underlying OS-level scheduled notification would still fire. Persisting it
  (e.g. a small `app_settings` table, or `expo-sqlite-kv-store`) is a natural
  Phase 3 follow-up once a second module wants the same pattern.

### Breathing Practice — built
- SQLite table: `breathing_logs`; pattern catalog (box breathing, 4-7-8,
  coherent breathing) is static content in code
- Screens: pattern list + weekly session count, and a session screen — pick a
  cycle count, then an animated expanding/contracting circle (React Native's
  built-in `Animated` API, no new dependency) paced to each step's duration
- Reusable piece produced: `useBreathingCycle()` — a ref-driven tick loop
  (deliberately not chained `setState` updaters, which race across a step
  boundary) that any future step-timed module can reuse
- Visual-only by design (per the original module spec) — no audio dependency

### Affirmations — built
- SQLite table: `affirmations` — seeded once (v3 migration) with 15 built-in
  affirmations that are ordinary editable/favoritable/deletable rows, not a
  separate hardcoded list; user-added custom ones live in the same table
  (`is_custom` just distinguishes provenance, nothing else treats them
  differently)
- Screens: hero card showing a day-seeded "today's affirmation" (stable for
  the whole day — a `Shuffle` button browses others without changing what
  "today's" actually is), favorites section, full browsable list, add-custom
  form
- Not built: deleting/editing existing affirmations from the browse list
  (only favorite-toggle and add-new)

### Finance Tracking — built
- SQLite tables: `finance_accounts` (cash/general/investment/credit, a
  `current_balance` never written directly by application code),
  `finance_categories` (11 seeded income/expense categories), `finance_transactions`
  (income/expense/transfer, transfers move money between two of the user's
  own accounts), and `finance_budgets` (weekly/monthly limits, one row).
  A SQLite trigger on `finance_transactions` (insert/update/delete) keeps
  `current_balance` correctly in sync automatically — application code never
  computes a new balance by hand.
- Screens: Accounts Dashboard (net worth, budget progress bars, accounts
  grouped by type, recent transactions), Add Account, Transaction Form
  (Income/Expense/Transfer toggle, account/category pickers, quick date
  chips), transaction detail (note edit + delete), Analytics (month nav,
  income/expense/net `<StatCard />` row, `<DonutChart />` by category).
- Known simplification: currency is set per-account but there's no live
  exchange-rate conversion — net worth simply sums raw balances across
  accounts regardless of currency.
- Reusable piece produced: `<StatCard />` (see Shared shell)

### Food Tracker — built
- SQLite table: `food_logs`
- Screens: day view (prev/next day arrows) with a calories `<StatCard />` and
  a protein/carbs/fat row, entries grouped by meal (long-press to remove);
  new-entry form (meal chips, calories required, macros optional)
- Calorie/macro values are manual estimates the user types in — there's no
  nutrition database or API to look them up (no backend, per the app's
  constraints), consistent with how the rest of the app self-reports rather
  than computes
- Not built: an edit screen (delete-and-recreate is the only correction path
  today)

### Mind Training — built
- SQLite table: `mind_training_logs` (generic `exercise_key` + `score` — each
  exercise interprets its own units); exercise catalog is static content in
  code, same split as Meditation/Breathing/Finance
- Three mini-games, each a self-contained component under
  `modules/mind-training/games/`:
  - **Reaction Time** — tap the instant the screen turns green; mistiming
    (tapping early) is called out as "too soon" rather than scored
  - **Sequence Memory** — a Simon-style growing tile pattern; score = highest
    level cleared before a miss
  - **Go / No-Go** — 15 timed trials (green = tap, red = don't); score =
    accuracy %
- Screens: exercise list with personal-best per exercise, a single detail
  screen that renders whichever game matches the route's `exerciseKey`
- Not built: difficulty settings, a "best of 3" mode for Reaction Time (every
  attempt is logged individually — best score is derived at read time)

### Workout Suggestions — built
- SQLite tables: `workout_preferences` (single upserted row — goal, owned
  equipment, time available) and `workout_logs`; the 10-workout catalog is
  static content in code
- `pickRecommendedWorkout()` (`modules/workout/recommend.ts`) is a pure
  function: filters by equipment (hard constraint — no barbell workout
  without a barbell), then by time available (relaxing if nothing fits),
  then prefers an exact goal match; a day-of-year seed makes the pick stable
  for the day, same pattern as Affirmations' daily pick
- Screens: preferences editor (goal/equipment/time chips) + today's
  recommendation with a "Mark complete" button, a full catalog browse screen,
  and a shared workout-detail screen used by both entry points
- Not built: adjusting a recommendation's difficulty/sets, exercise-level
  tracking (only whole-workout completion is logged)

### Analytics Dashboard — built
- Owns no tables — `useAnalyticsDashboard()` (`modules/analytics/useDashboard.ts`)
  queries `habits`, `habit_logs`, `tasks`, `journal_entries`,
  `meditation_logs`, `breathing_logs`, `finance_transactions`, and `food_logs`
  directly, densifies each into a 14-day series via `buildDailySeries()` (zero
  for days with no data — never a gap), and returns summary stats alongside
  the series
- Screen: two rows of `<StatCard />` (active habits, tasks completed, avg
  mood, wellness minutes, spend, avg calories/day) followed by six
  `<TrendChart />` rows — habit completions, task completions, mood (mapped
  great→5 … rough→1, reusing Journal's own `MOODS` list rather than
  duplicating it), combined meditation+breathing minutes, spending, calories
- Known simplification: "spend vs. budget" from the original spec is shown as
  a spending trend only — there's no budget concept anywhere in Finance to
  compare against yet (no budget-setting screen exists)

### Shared shell — built
- Bottom tabs (Today / Habits / Tasks / Journal / More), each a nested Stack
- Design tokens + `ThemeProvider` (system-driven light/dark)
- `useLocalTable<T>()` generic CRUD hook every simple-CRUD module wraps
- `<StatCard />` and `<TrendChart />` — generic stat tile and bar-row trend
  chart, first built for Finance/Food, now the backbone of the Analytics
  Dashboard
- Notification permission request + `scheduleDailyReminder()` helper —
  actually wired (see Meditation, Phase 2)
- Today tab: a 7-day week strip plus a search box and a full month-calendar
  modal (`<CalendarMonthGrid />`, prev/next navigation) — any date picked from
  either updates the same selected day; All/Important/Habits/Task/Recurring
  Task filter chips; a merged, search-filtered list of every habit, one-time
  task, and recurring task due/relevant that day, every single one opening
  the same `<HabitLogSheet />`/`<TaskLogSheet />` used elsewhere (Today has no
  separate logging UI of its own — including one-time tasks as of Phase 6);
  plus links out to Journal (quick-write) and Insights (Analytics Dashboard)

## Possible follow-ups
Nothing here blocks any module from working — these are the simplifications
each module section calls out individually, collected in one place:
- Meditation's reminder toggle isn't persisted across app restarts
- Finance's currency is hardcoded to USD; no currency setting
- Food Tracker has no edit screen (delete-and-recreate only)
- Task/habit checklists and category list don't support drag-to-reorder
  (`sort_order` column exists on tasks, unused by any UI)
- No native OS date/time picker anywhere — quick-select date chips and a
  custom `<TimeField />` (hour/minute + AM/PM, 12h/24h-aware) instead
- Analytics' "spend vs. budget" is spend-only — no budget concept exists yet
- Mind Training has no difficulty settings or multi-attempt averaging
- Categories can be created but not edited or deleted
- "Periodic" habits/tasks (X times per Y days) show period progress, not a
  streak — a day-streak isn't a well-defined concept without a fixed due day
- Habit/Task creation is one scrolling form, not the animated multi-step
  wizard from the reference design (same fields and order, no step
  navigation to build/debug)
- Task "Alarm" is a local notification with sound, not a true system alarm
  (no full-screen ringing/vibrate-until-dismissed — needs native alarm APIs
  outside Expo's managed workflow)
- Only one reminder offset per task, and reminders/alarms only exist for
  one-time tasks, not recurring ones
- Settings has one preference (time format) — no currency setting yet, even
  though the table it lives in was designed to hold more
- No password reset, email verification, or OAuth/social login — signup +
  login by email-or-username + password is the whole auth surface
- Toggling a task between single/recurring from the Edit tab doesn't persist
  (`updateTask()` never writes `is_recurring`) — pre-existing since Phase 5,
  not introduced or fixed by the Phase 6 detail-screen rebuild
- Habit "Restart progress" / Task "Clear completion history" are irreversible
  with no confirmation beyond the one alert — no undo
- Streak-challenge badge tiers (7/30/100 days) are fixed, not configurable,
  and purely cosmetic (no reward beyond the badge itself)

## Explicitly out of scope
Cloud sync of app data, social/sharing, wearable integration. Real accounts
exist purely as a sign-in gate via Supabase Auth — no habit/task/journal/
finance/etc. data is ever sent to or stored in Supabase. A V2 goal is
syncing SQLite to Supabase for real cross-device data; V1 deliberately keeps
that out of scope in exchange for the simplest possible architecture (no
backend to host, nothing that can drift out of sync).
