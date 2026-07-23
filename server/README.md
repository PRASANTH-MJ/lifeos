# lifeos-server

The auth backend for LifeOS — the only server-side piece of an otherwise
fully local-first app. It exists solely to handle account signup/login; it
does **not** store or sync any habit/task/journal data, which stays in the
app's on-device SQLite exactly as before.

## Stack

- Express
- `better-sqlite3` — a separate, server-side SQLite database (`data.sqlite`,
  gitignored), unrelated to the app's local database
- `bcryptjs` for password hashing, `jsonwebtoken` for session tokens

## Run locally

```bash
cd server
npm install
npm start          # listens on http://localhost:4000
```

Set a real `JWT_SECRET` env var for anything beyond local testing — without
one, it falls back to an insecure default and prints a warning on startup.

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

1. Set `JWT_SECRET` (and optionally `PORT`) on the host.
2. Point the app at it — see `EXPO_PUBLIC_API_URL` in the root `README.md`.

`better-sqlite3` is a native module; most hosts rebuild it automatically on
install, but if a host's build step skips native rebuilds, you may need to
switch it for a hosted database (Postgres, etc.) instead.
