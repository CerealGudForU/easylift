// TanStack Query for server-only data (feed, friends, comments, notifications).
// Training data never goes through here: it lives in the offline store (src/lib/data).
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useSession } from './session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

// Refetch stale queries when the app comes back to the foreground (the browser does this itself).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id ?? null;
  const last = useRef(uid);
  // Another account's feed must never show for a moment after switching users.
  useEffect(() => {
    if (last.current !== uid) queryClient.clear();
    last.current = uid;
  }, [uid]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
