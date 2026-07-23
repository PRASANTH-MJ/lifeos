import { createClient } from '@supabase/supabase-js';

import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from './config.js';

// Service-role client — bypasses Row Level Security entirely. This is safe
// ONLY because it's used exclusively here, server-side, and every query below
// is manually scoped to the authenticated user's id (from the app's own JWT,
// verified by middleware/authenticate.js). Never send this key to a client.
export const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;
