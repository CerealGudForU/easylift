// TanStack Query for server-only data (feed, friends, comments, notifications).
// Training data never goes through here: it lives in the offline store (src/lib/data).
//
// The last loaded feed, friends, profiles and notifications are saved on the device, so
// they show straight away on launch and offline (then refresh when there's a connection).
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, QueryClient, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { authStorage } from './auth-storage';
import { useSession } from './session';

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime must be at least the saved copy's maxAge, or restored data is thrown away.
    queries: { staleTime: 30_000, retry: 1, gcTime: 7 * DAY },
    mutations: { retry: 0 },
  },
});

// localStorage on web; the SQLite-backed localStorage on native (same as the session).
const persister = authStorage
  ? createSyncStoragePersister({ storage: authStorage, key: 'easylift:query-cache', throttleTime: 2000 })
  : undefined;

// Worth keeping between launches. Search results and per-photo signed URLs (which expire)
// are not.
const SAVED = new Set(['feed', 'friends', 'friends-now', 'profile', 'notifications', 'post', 'comments', 'calendar']);
const shouldSave = (q: Query) => q.state.status === 'success' && SAVED.has(String(q.queryKey[0]));

// Refetch stale queries when the app comes back to the foreground (the browser does this itself).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  // Wait until we know who is signed in (the splash screen is still up): the saved copy
  // is tied to that account, and restoring before then would discard it.
  if (loading) return null;
  return <PersistedQueries uid={session?.user.id ?? null}>{children}</PersistedQueries>;
}

function PersistedQueries({ uid, children }: { uid: string | null; children: ReactNode }) {
  const last = useRef(uid);
  // Another account's feed must never show for a moment after switching users.
  useEffect(() => {
    if (last.current !== uid) queryClient.clear();
    last.current = uid;
  }, [uid]);

  if (!persister) return <PersistQueryClientProvider client={queryClient} persistOptions={NO_PERSIST}>{children}</PersistQueryClientProvider>;
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * DAY,
        // A saved copy from a different account is discarded instead of restored.
        buster: uid ?? 'signed-out',
        dehydrateOptions: { shouldDehydrateQuery: shouldSave },
      }}>
      {children}
    </PersistQueryClientProvider>
  );
}

// Server rendering / no storage: nothing to save to.
const NO_PERSIST = {
  persister: { persistClient: () => {}, restoreClient: () => undefined, removeClient: () => {} },
};
