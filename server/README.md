# lifeos-server

The backend for LifeOS. It handles account signup/login and the Finance
module; habit/task/journal/etc. data stays in the app's on-device SQLite
exactly as before.

## Stack

- Express
- Supabase (Postgres) — the one persistent database, shared by every client
  (web + mobile). Holds `users` (auth) and the Finance tables
  (`accounts`/`categories`/`transactions`). The backend talks to it with the
  **service-role key**, which bypasses Row Level Security — every query is
  manually scoped to the authenticated user's id from the app's own JWT, so
  RLS is enabled with no policies (default-deny) as a safety net.
- `bcryptjs` for password hashing, `jsonwebtoken` for session tokens

## Run locally

```bash
cd server
npm install
npm start          # listens on http://localhost:4000
```

Set a real `JWT_SECRET` env var for anything beyond local testing — without
one, it falls back to an insecure default and prints a warning on startup.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from the Supabase
project's Settings → API page) — without both, `/auth/*` and `/finance/*`
return `503` with a clear error instead of crashing. Run `sql/users_schema.sql`
and `sql/finance_schema.sql` once in that project's SQL Editor to create the
tables.

## Endpoints

| Method | Path           | Body                              | Notes                          |
|--------|----------------|------------------------------------|---------------------------------|
| POST   | `/auth/signup` | `{ email, username, password }`   | password ≥ 8 chars             |
| POST   | `/auth/login`  | `{ identifier, password }`        | `identifier` = email or username |
| GET    | `/auth/me`     | —, `Authorization: Bearer <token>` | for restoring a session on launch |

## Deploying it somewhere real

This only runs on your own machine until you deploy it. Any Node host works
(Railway, Render, Fly.io, a VPS, etc.) — that's a hosting decision that needs
your own account, so it's not something done for you here. Once deployed:

1. Set `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and
   optionally `PORT`) on the host.
2. Point the app at it — see `EXPO_PUBLIC_API_URL` in the root `README.md`.

Because the database is Supabase (not a file on the host's own disk), this
works cleanly even on hosts with no persistent disk, like Render's free tier —
there's nothing local to lose on redeploy/restart.
