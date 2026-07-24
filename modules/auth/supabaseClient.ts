import { createClient } from '@supabase/supabase-js';

import { deleteSecureItem, getSecureItem, setSecureItem } from './secureStorage';

// The only cloud dependency in the app — everything else is on-device SQLite.
// Uses the public anon key (safe to ship in the app); Supabase's Row Level
// Security on auth.users means this key can only ever act as "whoever is
// currently signed in," never anyone else.
const configured = Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

if (!configured) {
  console.warn(
    '[auth] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — sign in/up will fail until both are configured.'
  );
}

// createClient() throws synchronously on an empty/invalid URL, which would
// crash the whole app at startup before it could even show the login screen.
// Falling back to a syntactically valid placeholder means the app still
// boots — sign-in calls then fail normally (a real, catchable error) instead
// of a blank crash screen.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: { getItem: getSecureItem, setItem: setSecureItem, removeItem: deleteSecureItem },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
