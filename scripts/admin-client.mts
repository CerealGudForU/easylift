// Service-role Supabase client for local admin scripts. Bypasses RLS, so it
// must never be bundled into the app. Reads .env.local.
import { createClient } from '@supabase/supabase-js';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Fall back to the real environment.
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
  console.error('(Supabase dashboard > Project Settings > API Keys > Secret keys).');
  process.exit(1);
}

export const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
