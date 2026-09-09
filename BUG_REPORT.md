# Flowsy — Bug Report

Run date: 2026-09-06. Only defects actually observed or confirmed via code review this session are listed — nothing speculative.

---

## BUG-001: Web build's page `<title>` is empty

- **Feature:** Web application / document head
- **Severity:** Low
- **Steps to reproduce:**
  1. `curl -s https://lifeos-8f0bf.web.app/`
  2. Inspect the `<head>` of the returned HTML.
- **Expected result:** `<title>` contains a descriptive app name, e.g. `<title>Flowsy</title>`, so the browser tab and bookmarks show a meaningful name.
- **Actual result:** `<title data-rh="true"></title>` — completely empty. Browser tab shows the URL/blank instead of "Flowsy".
- **Screenshot or log:**
  ```
  <!DOCTYPE html><html  lang="en"><head><title data-rh="true"></title>...
  ```
- **Suggested solution:** expo-router web builds populate `<title>` via `expo-router`'s `<Head>`/`react-helmet-async` integration (the `data-rh="true"` attribute confirms react-helmet is wired up but never given a title). Add a title in the root layout (e.g. `app/_layout.tsx` or a dedicated `app/+html.tsx`) — either a static `<Head><title>Flowsy</title></Head>` or via `expo.web.name`/`expo.name` if the current export step doesn't already surface it. Not fixed in this session per the instruction not to change existing features beyond what testing requires — flagged for a decision.

---

## BUG-002 (found and fixed this session, logged for the record): Short GPS cardio sessions were silently discarded with no save/share prompt

- **Feature:** Cardio GPS recording (`app/(tabs)/cardio/[activity]/record.tsx`)
- **Severity:** High (real user-reported repro: "gps entry 0.01km i finished its only asking me save no suggestion to feed")
- **Steps to reproduce (pre-fix):**
  1. Start a GPS-recorded cardio activity.
  2. Stop it in under 30 seconds (e.g. a ~0.01km test walk).
  3. Tap Finish.
- **Expected result:** Always reach the "Save Activity" screen, then (after Save) the "Share this with your followers?" post-to-Feed prompt, regardless of session length.
- **Actual result (pre-fix):** `onFinish` only forwarded to the save screen when `result.elapsedSeconds >= 30`; anything shorter called `router.back()` with **no alert, no save, no share prompt at all** — the session's data was silently lost and the user saw no explanation, which is exactly what was reported.
- **Screenshot or log:** N/A (confirmed via source read, `app/(tabs)/cardio/[activity]/record.tsx`, prior version).
- **Suggested solution / status:** **Already fixed in this session's code and included in `flowsy-v47.apk`.** The `elapsedSeconds >= 30` gate was removed; the handler now proceeds to the save screen whenever `stopTracking()` returns a real result (it only ever returns `null` when there was no active session to stop at all). Verifying this live still requires a real or mocked GPS session (see TC-CAR-01 in TEST_RESULTS.md, marked Manual since it wasn't re-exercised end-to-end on device this run).

---

## Non-bugs investigated and ruled out

Documented here so they aren't re-investigated in a future pass:

- **"Stale" validation banner on the login screen** — during manual testing, the "Enter a valid email…" banner appeared to persist unchanged after entering valid-format credentials and tapping "Sign in". Root-caused to **tester error**, not an app bug: the tap coordinates were taken from a pre-scaled screenshot (900×2000) without multiplying back to the real 1080×2400 device resolution, so the tap missed the button entirely and no resubmission occurred. Once corrected, the banner updated correctly to "Incorrect email or password." (see TC-AUTH-03, Passed).
- **Hardcoded Firebase `apiKey` in `firebase/config.ts`** — flagged by an automated secret-pattern scan, but Firebase web/client API keys are not sensitive by Firebase's own security model (they identify the project; access is enforced by Firestore/Storage security rules, not by keeping this key private). Not a vulnerability; no action needed.
- **Release Hermes bundle unreadable by `grep`** — initially looked like a scan failure, but the bundle's magic bytes (`C6 1F BC 03`) confirm it's compiled Hermes bytecode, not plain-text JS. This is the expected, and more secure, state for a release build (harder to statically reverse-engineer than an unminified bundle).

---

## Items requiring a decision (not bugs, but open gaps found during inspection)

- No ESLint is configured anywhere in this repo. If code-quality linting is wanted going forward, it needs to be added (config + devDependency) — not done in this session since it's a tooling addition, not a test-configuration fix.
- No Playwright/Detox/Maestro installed — full web E2E and mobile E2E automation are unavailable until one is added, which requires an `npm install` the user would need to run or approve.
