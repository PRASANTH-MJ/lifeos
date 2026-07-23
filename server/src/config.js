// A real deployment MUST set JWT_SECRET via the environment — this fallback
// exists only so `npm start` works out of the box for local development.
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

if (JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.warn(
    '[lifeos-server] Using the default JWT_SECRET. Set the JWT_SECRET environment variable before deploying anywhere real.'
  );
}

export const PORT = Number(process.env.PORT ?? 4000);
