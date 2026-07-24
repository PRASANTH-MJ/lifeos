// A real deployment MUST set JWT_SECRET via the environment — this fallback
// exists only so `npm start` works out of the box for local development.
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

if (JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.warn(
    '[lifeos-server] Using the default JWT_SECRET. Set the JWT_SECRET environment variable before deploying anywhere real.'
  );
}

export const PORT = Number(process.env.PORT ?? 4000);

// Supabase Postgres — the single persistent database backing both the users
// table (auth.js) and the Finance module (finance.js). The service-role key
// must NEVER be sent to the client; it lives only here, server-side. Auth and
// Finance routes both return a clear 503 until both are set.
export const SUPABASE_URL = process.env.SUPABASE_URL ?? null;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[lifeos-server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — signup/login and Finance endpoints will return 503 until both are configured.'
  );
}
