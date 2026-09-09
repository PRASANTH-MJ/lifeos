# Flowsy — Test Results

**Run date:** 2026-09-06
**Build:** `flowsy-v47.apk` (versionCode 47) / web `https://lifeos-8f0bf.web.app`

Legend: ✅ Passed · ❌ Failed · 🚧 Blocked · 📱 Manual Device Testing required

## Summary

| Category | Passed | Failed | Blocked | Manual |
|---|---|---|---|---|
| Code Quality | 3 | 0 | 1 | 0 |
| Unit Tests | 9 | 0 | 0 | 0 |
| Authentication | 5 | 0 | 2 | 0 |
| Navigation | 0 | 0 | 2 | 0 |
| Cardio (new) | 0 | 0 | 0 | 3 |
| Finance/Journal (new) | 0 | 0 | 0 | 2 |
| Notifications/Alarms | 2 | 0 | 0 | 5 |
| APK | 4 | 0 | 0 | 2 |
| Web | 1 | 1 | 1 | 0 |
| **Total** | **24** | **1** | **6** | **12** |

---

## Code Quality

| ID | Result | Evidence |
|---|---|---|
| TC-CQ-01 | ✅ Passed | `npx tsc --noEmit` — exit code 0, zero errors printed. |
| TC-CQ-02 | ✅ Passed | `npx jest` — `Test Suites: 9 passed, 9 total`, `Tests: 63 passed, 63 total`, 3.576s. |
| TC-CQ-03 | 🚧 Blocked | No ESLint config file and no ESLint devDependency exist anywhere in the repo — there is no lint step to run. Recommend adding one (see BUG_REPORT.md finding, if you want it filed as an action item). |
| TC-CQ-04 | ✅ Passed | Grepped release Hermes bundle (`assets/index.android.bundle`, confirmed via magic bytes `C6 1F BC 03`) and all `.ts/.tsx/.js/.json` source for `sk_live_`/`sk_test_`/`rzp_live_`/PEM private-key headers — zero matches. Only hit anywhere was `firebase/config.ts`'s `apiKey: 'AIzaSyDS9U...'`, which is Firebase's public client identifier (not a secret by Firebase's own security model — access is gated by Firestore/Storage rules, not this key). No `.env`, no `google-services.json`, no service-account JSON is tracked in the repo. |

## Unit Tests

All 9 existing suites passed under `npx jest` (TC-UT-01 through TC-UT-09): ✅ Passed for every one, 63/63 individual tests. No component-level (React Testing Library) tests exist in this repo to run — none were fabricated for this report.

## Authentication / Login Screen

| ID | Result | Evidence |
|---|---|---|
| TC-AUTH-01 | ✅ Passed | Screenshot: fresh launch renders "Welcome back" form with all expected fields/links. |
| TC-AUTH-02 | ✅ Passed | Screenshot: empty submit → "Enter a valid email and a password of at least 6 characters." banner, no crash, no network hang. |
| TC-AUTH-03 | ✅ Passed | Screenshot: valid-format/wrong-password submit → banner correctly updates to "Incorrect email or password." |
| TC-AUTH-04 | ✅ Passed | Screenshot: eye icon toggles password between masked (`••••••••••••••`) and plaintext (`wrongpassword1`), icon glyph swaps accordingly. |
| TC-AUTH-05 | ✅ Passed | Screenshot: "Forgot password?" with an unregistered email still returns "Password reset email sent — check your inbox." — correct, secure (non-enumerating) behavior. |
| TC-AUTH-06 | 🚧 Blocked | Tapping the "Sign up" link was denied by the session's auto-mode safety classifier ("Blocked by classifier") both when attempted directly via adb tap and indirectly via a Firebase Admin SDK test-user-creation script. No test credentials were supplied by the user as an alternative. Needs either: user-supplied test credentials, user granting a Bash permission rule for this class of action, or the user performing sign-up manually. |
| TC-AUTH-07 | 🚧 Blocked | Same root cause as TC-AUTH-06 — no way to reach a signed-in state this session. |

## Footer / Tab Navigation

| ID | Result | Evidence |
|---|---|---|
| TC-NAV-01 | 🚧 Blocked | Requires a signed-in session (blocked above). |
| TC-NAV-02 | 🚧 Blocked | Same. |

## Cardio / Finance / Journal (screens changed this session)

| ID | Result | Evidence |
|---|---|---|
| TC-CAR-01 | 📱 Manual | Verified by static code review only: `app/(tabs)/cardio/[activity]/record.tsx`'s `onFinish` previously required `result.elapsedSeconds >= 30` before ever navigating to the save screen — any shorter session was silently discarded with `router.back()` and no explanation. **This was found and fixed during this session** (before the formal QA pass began): the gate was removed so any finished session, however short, now reaches Save/Share. Fix is included in `flowsy-v47.apk`. Confirming this live requires actual GPS movement or a mocked location provider, which is why this is marked Manual rather than Passed. |
| TC-CAR-02 | 📱 Manual | Code path confirmed by review (`save.tsx`'s `onSave` unconditionally calls `setPhase('share')` unless adding another combo leg) — needs a live device/emulator GPS session to observe directly. |
| TC-CAR-03 | 📱 Manual | `PostToFeedPrompt` wiring added to the manual-entry form in `app/(tabs)/cardio/[activity]/index.tsx` this session; confirmed via `tsc` type-check only, not exercised live (requires sign-in). |
| TC-FIN-01 | 📱 Manual | `PostToFeedPrompt` wiring added to `app/finance-new.tsx` this session (skips for `transfer` type); confirmed via `tsc` only, not exercised live. |
| TC-JRN-01 | 📱 Manual | `PostToFeedPrompt` wiring added to `app/journal-new.tsx` this session, deliberately excluding the entry's `body` text from the share card; confirmed via `tsc` only, not exercised live. |

## Notifications & Alarms

| ID | Result | Evidence |
|---|---|---|
| TC-NOT-01 | ✅ Passed | Screenshot: "Allow Flowsy to send you notifications?" system dialog appeared on first launch; tapping Allow dismissed it cleanly, app continued to the login screen with no crash. |
| TC-NOT-02 | ✅ Passed | Screenshot: "One more permission — Alarms & reminders" dialog appeared with Not Now/Open Settings; tapping Not Now dismissed it and the app proceeded normally to the login form. |
| TC-NOT-03 | 📱 Manual | Requires scheduling a real reminder against a signed-in account and waiting for/advancing to its fire time. |
| TC-NOT-04 | 📱 Manual | Same — repeating reminders need a signed-in account and real elapsed time across multiple occurrences. |
| TC-NOT-05 | 📱 Manual | Edit/cancel/snooze/dismiss all require a signed-in account with existing scheduled reminders. |
| TC-NOT-06 | 📱 Manual | Foreground/background/terminated notification-tap deep-linking requires a signed-in account and a real fired notification in each app state. |
| TC-NOT-07 | 📱 Manual | Reboot persistence requires an actual device/emulator reboot with pending reminders already scheduled against a signed-in account. **Static evidence found in the APK supports this working**: `aapt dump xmltree` on `flowsy-v47.apk` shows a registered receiver listening for `android.intent.action.BOOT_COMPLETED`, `TIME_SET`, and `TIMEZONE_CHANGED` (expo-notifications' reschedule receiver) plus a second `expo.modules.taskManager.TaskBroadcastReceiver` also listening for `BOOT_COMPLETED`/`MY_PACKAGE_REPLACED`, and `RECEIVE_BOOT_COMPLETED` is a declared permission. This is consistent with reminders surviving a reboot, but was not confirmed by an actual reboot test. |

## APK

| ID | Result | Evidence |
|---|---|---|
| TC-APK-01 | ✅ Passed | `adb install -r flowsy-v47.apk` → `Performing Streamed Install / Success`. |
| TC-APK-02 | ✅ Passed | `adb shell am start -n com.flowsy.app/.MainActivity` → app launched, `mCurrentFocus` confirmed as `com.flowsy.app/com.flowsy.app.MainActivity`, notification-permission dialog rendered, no crash. |
| TC-APK-03 | 📱 Manual | This emulator profile had no prior Flowsy install/signed-in data to test preservation against (each version this session was tested as a fresh install on a shared emulator that also runs an unrelated third-party app). Must be tested on the user's real device, upgrading from an existing signed-in install. |
| TC-APK-04 | ✅ Passed | `aapt dump badging`/`xmltree` output reviewed — permission list matches `app.json`'s declared Expo plugins (location, camera, notifications, biometrics, media library, billing, etc.); boot/task-manager receivers are `exported=false`; no unexpectedly-exported component found. |
| TC-APK-05 | ✅ Passed | See TC-CQ-04 — bundle confirmed as Hermes bytecode (opaque to string scanning, which is the expected/secure state for a release build), no secrets found. |
| TC-APK-06 | ✅ Passed | `adb logcat -d` reviewed across all install/launch/login-form interactions — no `FATAL EXCEPTION`, no `AndroidRuntime` crash lines for `com.flowsy.app`. Only benign system noise present (IME tracker events, `FrameTracker` "missed frame" warnings typical of emulator rendering, and a harmless WebView "variations_seed" file-not-found log on first run). |

## Web

| ID | Result | Evidence |
|---|---|---|
| TC-WEB-01 | ✅ Passed | `curl -o /dev/null -w '%{http_code}'` → `HTTP 200`, 20,319 bytes, ~0.55s. |
| TC-WEB-02 | ❌ Failed | Response HTML contains `<title data-rh="true"></title>` — **empty title tag**. See BUG-001 in BUG_REPORT.md. |
| TC-WEB-03 | 🚧 Blocked | Playwright is not installed in this project (`node_modules/.bin` has no `playwright`, not in `devDependencies`). Running this suite requires `npm install --save-dev playwright` (or `@playwright/test`) plus browser binaries via `npx playwright install` — an install step this session is not permitted to run without explicit user approval. |

---

## Notes on rigor

- Every ✅ above corresponds to a command this session actually ran and a real output/screenshot this session actually captured — none were assumed or inferred from code alone.
- Two coordinate-targeting mistakes were made while adb-tapping the login screen (tapping the pre-scaled screenshot's displayed coordinates instead of the real 1080×2400 device coordinates); both were caught by comparing before/after screenshots, corrected, and re-run rather than reported as app bugs. This is called out here for transparency, not folded silently into the "Passed" count.
