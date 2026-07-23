// A real deployment MUST set JWT_SECRET via the environment — this fallback
// exists only so `npm start` works out of the box for local development.
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

if (JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.warn(
    '[lifeos-server] Using the default JWT_SECRET. Set the JWT_SECRET environment variable before deploying anywhere real.'
  );
}

export const PORT = Number(process.env.PORT ?? 4000);

// Finance module (Supabase) — the service-role key must NEVER be sent to the
// client; it lives only here, server-side. Finance routes no-op with a clear
// error until both are set (see finance.js).
export const SUPABASE_URL = process.env.SUPABASE_URL ?? null;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[lifeos-server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — Finance endpoints will return 503 until both are configured.'
  );
}
