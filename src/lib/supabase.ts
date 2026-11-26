import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { authStorage } from './auth-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).');
}

export const supabase = createClient(url, key, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No OAuth or magic links: sessions never arrive in a URL.
    detectSessionInUrl: false,
  },
});

// Native apps only refresh the token while in the foreground. The browser handles this itself.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
