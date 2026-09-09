# Flowsy — Test Plan

**Date:** 2026-09-06
**Build under test:** `flowsy-v47.apk` (versionCode 47), web build deployed to `https://lifeos-8f0bf.web.app`
**Package:** `com.flowsy.app`
**Environment:** macOS, Android emulator `emulator-5554`, Node/Expo SDK 57, Firebase project `lifeos-8f0bf`

## 1. Scope

| Area | In scope | Tooling available this session |
|---|---|---|
| Code quality | TypeScript, lint, existing unit tests | `tsc`, `jest` (ESLint **not configured** in this repo) |
| Unit/component tests | Existing `__tests__/*` suite | Jest + jest-expo preset |
| Mobile UI/functional | Manual adb-driven walkthrough on emulator | adb, screencap (no Detox/Maestro installed) |
| Alarms/notifications | Code inspection + manifest inspection + permission-dialog UI check | adb, `aapt` |
| APK | Install, launch, permissions, crash logs, secret/URL scan | adb, aapt, unzip |
| Web | Hosting reachability smoke check | curl (**Playwright not installed** — full browser E2E out of scope this run) |

## 2. Environment inventory (as found)

- `package.json` scripts: `start`, `android`, `ios`, `web`, `typecheck`, `test`, `verify`. No `lint` script.
- No ESLint config file anywhere in the repo (`.eslintrc*`, `eslint.config*` both absent) and ESLint is not a devDependency.
- No Playwright, Detox, or Maestro in `devDependencies` or `node_modules/.bin`.
- Existing automated tests: 9 Jest suites / 63 tests under `__tests__/` (pure-logic unit tests: streaks, GPS filtering, milestones, session math, sync schema, date utils, life score, timer aggregation, workout streak). No component-level (React Testing Library) tests exist.
- Notification/alarm code lives in `modules/notifications/` (push token registration only) plus per-domain schedulers: `modules/tasks/scheduleTaskNotifications.ts`, `modules/habits/scheduleHabitNotifications.ts`, `modules/finance/schedulePlannedPaymentNotifications.ts`, `modules/social/groupNotifications.ts` — all built on `expo-notifications`.
- Auth: `modules/auth/useAuth.ts` + `LoginScreen.tsx`, backed by Firebase Auth (email/password).
- Local storage: AsyncStorage used across cardio tracking, sync engine, reminders, meditation sound overrides, etc.; SQLite (`expo-sqlite`) is the primary local data store per `db/schema.ts`.
- API integration: Firebase (Firestore, Auth, Storage, Cloud Functions, Hosting), Razorpay (billing), OpenFreeMap/Esri (map tiles) — no other third-party REST APIs found in source.

## 3. What was actually executed this run

- `npx tsc --noEmit` (full project)
- `npx jest` (full project)
- A real adb-driven walkthrough of the **login/auth screen** on the connected emulator (empty-submit validation, invalid-credential error, password-visibility toggle, forgot-password flow)
- APK install (`adb install -r`) + first-launch + notification-permission + exact-alarm-permission dialogs on the emulator
- `adb logcat` crash scan across all of the above interactions
- `aapt dump badging` / `aapt dump xmltree` against the release APK (permissions, manifest receivers)
- Static secret/URL scan of the release JS bundle and repo source
- `curl` smoke check of the deployed Firebase Hosting URL

## 4. What was explicitly NOT executed, and why

| Item | Reason |
|---|---|
| Full authenticated in-app testing (Cardio, Clubs, Feed, Finance, Habits, Tasks, Settings, etc.) | No test-account credentials were available, and the auto-mode safety classifier blocked both (a) programmatically creating a Firebase Auth test user via the Admin SDK, and (b) tapping the in-app "Sign up" link via adb. Marked **Blocked** — see TEST_RESULTS.md. |
| ESLint run | Not installed/configured in this project at all — there is nothing to run. |
| Playwright Chrome/Firefox/responsive E2E | Not installed. Installing it requires `npm install`, which this session is not permitted to run unattended; needs explicit user approval. |
| Detox / Maestro mobile E2E | Not installed. |
| Real alarm firing in background/terminated app states, behavior after an actual device reboot, notification deep-link tap-through | Requires a physical device (or a full emulator reboot + long-running background observation) and, for several cases, a signed-in account. Marked **Manual Device Testing**. |
| Data-preservation-on-upgrade test against the user's real account data | Only ever safe to run against the user's own device/account, not a throwaway emulator profile. |
| Unused-code / dead-export audit | No `depcheck`/`ts-prune` installed; not attempted rather than approximated by hand. |

## 5. Pass/Fail/Blocked taxonomy used in TEST_RESULTS.md

- **Passed** — executed this session, observed correct behavior directly (screenshot, log output, or tool exit code).
- **Failed** — executed this session, observed incorrect behavior (see BUG_REPORT.md).
- **Blocked** — could not be executed this session due to a concrete, named obstacle (missing credentials, missing tooling, classifier denial).
- **Manual Device Testing** — requires a physical Android device and/or real user account; not attempted here by design, not because of a transient blocker.
