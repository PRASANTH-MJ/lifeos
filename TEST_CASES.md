# Flowsy — Test Cases

Each case lists an ID, area, steps, expected result, and its status is recorded in `TEST_RESULTS.md` (kept separate so this file stays a stable case catalog).

## Code Quality

- **TC-CQ-01** — Run `npx tsc --noEmit` from repo root. Expected: exits 0, no type errors printed.
- **TC-CQ-02** — Run `npx jest` from repo root. Expected: all suites pass, no snapshot failures.
- **TC-CQ-03** — Run project's ESLint config. Expected: N/A — no config exists (see TEST_PLAN.md §2).
- **TC-CQ-04** — Scan release JS bundle (`assets/index.android.bundle` inside the APK) and repo source for hardcoded secret patterns (`sk_live_`, `sk_test_`, `rzp_live_`, PEM private-key headers). Expected: no matches other than the standard, non-secret Firebase client `apiKey`.

## Unit Tests (existing suite, `__tests__/*`)

- **TC-UT-01** `cardioStreak.test.ts` — streak counts consecutive cardio-log days correctly, including the "not logged yet today" grace case.
- **TC-UT-02** `workoutStreak.test.ts` — same, for workout logs.
- **TC-UT-03** `gpsFiltering.test.ts` — accuracy rejection, speed-outlier rejection, elevation smoothing helpers.
- **TC-UT-04** `milestones.test.ts` — cardio milestone tier thresholds.
- **TC-UT-05** `sessionMath.test.ts` — pace/speed/elevation session math.
- **TC-UT-06** `syncSchema.test.ts` — sync engine schema helpers.
- **TC-UT-07** `date.test.ts` — date-key utilities.
- **TC-UT-08** `useLifeScore.test.ts` — Life Scoreboard composite score.
- **TC-UT-09** `timerAggregate.test.ts` — timer log aggregation/formatting for habit/task time tracking.

## Authentication / Login Screen (component + functional)

- **TC-AUTH-01** — Open the app while signed out. Expected: "Welcome back" sign-in form renders with Email, Password, Sign in button, Forgot password link, Sign up link.
- **TC-AUTH-02** — Tap "Sign in" with both fields empty. Expected: inline red validation banner "Enter a valid email and a password of at least 6 characters." appears; no network call attempted.
- **TC-AUTH-03** — Enter a validly-formatted but non-existent email + a 6+ character wrong password, tap "Sign in". Expected: banner updates to "Incorrect email or password."; button does not get stuck in a loading state.
- **TC-AUTH-04** — Tap the password field's eye icon. Expected: password glyph toggles between masked and plaintext; icon swaps between "eye" and "eye-off".
- **TC-AUTH-05** — Tap "Forgot password?" with an email entered. Expected: generic success message ("Password reset email sent — check your inbox.") regardless of whether the address is registered (no account-enumeration leak).
- **TC-AUTH-06** — Tap "Sign up". Expected: navigates to a sign-up form. *(Blocked this run — see TEST_RESULTS.md.)*
- **TC-AUTH-07** — Sign in with valid credentials. Expected: lands on the main tab bar (Productivity/Fitness/Finance/Mindfulness/Feed/More). *(Blocked — no credentials available.)*

## Footer / Tab Navigation

- **TC-NAV-01** — From the signed-in home, tap each of the 6 bottom tabs in turn. Expected: active tab is visually distinguished (color/weight), correct screen renders, no flash of unrelated content. *(Blocked — requires sign-in.)*
- **TC-NAV-02** — Deep-navigate 2+ levels into a tab (e.g. Cardio → an activity → Save), then use Android back gesture repeatedly. Expected: unwinds one screen at a time, ends back on the tab root, never force-closes the app. *(Blocked — requires sign-in.)*

## Cardio (GPS + manual entry) — newly touched this session

- **TC-CAR-01** — Record a GPS cardio session lasting only a few seconds (e.g. ~0.01km), tap Finish. Expected: always reaches the "Save Activity" screen (title/mood/weather/photo/Save), regardless of duration. *(Manual/device — requires real GPS movement or a mocked location provider.)*
- **TC-CAR-02** — From TC-CAR-01, tap "Save Activity". Expected: always reaches the "Share this with your followers?" screen with Post to Feed / Skip options.
- **TC-CAR-03** — Use the manual (non-GPS) "Log a session" form on a cardio activity screen. Expected: after "Log session", a post-to-Feed prompt (mood/streak-based) appears inline before returning to the log list.

## Finance / Journal — newly touched this session

- **TC-FIN-01** — Log a new expense or income transaction. Expected: after save, a post-to-Feed prompt appears (skipped for `transfer` type).
- **TC-JRN-01** — Save a new journal entry with a mood selected. Expected: a post-to-Feed prompt appears showing only the mood + weekly streak — never the entry's written body text.

## Notifications & Alarms

- **TC-NOT-01** — First app launch on a fresh install. Expected: OS "Allow Flowsy to send you notifications?" dialog appears; tapping Allow dismisses it and does not crash the app.
- **TC-NOT-02** — On the same fresh launch (Android 13+), an "Alarms & reminders" permission dialog appears ("One more permission… Not Now / Open Settings"). Expected: both buttons dismiss the dialog without crashing; "Not Now" does not block continued use of the app.
- **TC-NOT-03** — Schedule a one-time task/habit reminder, background the app, wait for the fire time. Expected: notification appears in the system tray. *(Manual device — requires real wall-clock wait or device time manipulation.)*
- **TC-NOT-04** — Schedule a repeating (recurring) reminder. Expected: fires on each subsequent occurrence. *(Manual device.)*
- **TC-NOT-05** — Edit a scheduled reminder's time, cancel it, and (where supported) snooze/dismiss a fired notification. Expected: the underlying `expo-notifications` schedule is correctly replaced/removed — no duplicate or orphaned notification fires later. *(Manual device.)*
- **TC-NOT-06** — Tap a fired notification while the app is (a) foregrounded, (b) backgrounded, (c) fully terminated. Expected: app opens/foregrounds and deep-links to the relevant screen (the task/habit/event the notification was about) in all three states. *(Manual device — all three sub-cases.)*
- **TC-NOT-07** — Reboot the device/emulator with pending scheduled reminders, then wait for a fire time. Expected: reminders still fire after reboot (manifest declares `RECEIVE_BOOT_COMPLETED` + a `BOOT_COMPLETED`/`TIME_SET`/`TIMEZONE_CHANGED` receiver — see TEST_RESULTS.md for the static evidence found). *(Manual device — requires an actual reboot.)*

## APK

- **TC-APK-01** — Install `flowsy-v47.apk` via `adb install -r` over no prior install. Expected: installs successfully.
- **TC-APK-02** — Launch the app for the first time. Expected: no crash, notification-permission dialog shown, login screen renders.
- **TC-APK-03** — Reinstall a newer versionCode over an existing install without uninstalling first (`adb install -r`). Expected: existing signed-in session / local SQLite data is preserved. *(Manual device against a real account — not run this session; this emulator profile had no prior signed-in Flowsy data to preserve.)*
- **TC-APK-04** — Inspect `AndroidManifest.xml` (via `aapt dump badging`/`xmltree`) for the declared permission set and any exported components. Expected: permission list matches `app.json`'s declared plugins; no unexpectedly-exported activity/receiver.
- **TC-APK-05** — Scan the release Hermes bundle for embedded secrets/API keys. Expected: none found (bundle is compiled bytecode, not plain-text JS, by design).
- **TC-APK-06** — Monitor `adb logcat` during install/launch/login-flow interaction. Expected: no `FATAL EXCEPTION` / `AndroidRuntime` crash entries for `com.flowsy.app`.

## Web

- **TC-WEB-01** — `curl` the deployed hosting root (`https://lifeos-8f0bf.web.app/`). Expected: HTTP 200.
- **TC-WEB-02** — Inspect the returned HTML `<title>` tag. Expected: a non-empty, descriptive title.
- **TC-WEB-03** — Full Playwright pass: buttons, footer/nav, forms, API calls, auth, loading/error states across Chrome, Firefox, and responsive breakpoints. *(Blocked — Playwright not installed this session.)*
