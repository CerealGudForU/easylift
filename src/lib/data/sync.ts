// Background sync between the device store and Supabase.
// Push: every dirty row, parents first, upserted on id (the server's keep_newest
// trigger skips stale copies). Pull: rows changed since the last pull (by the
// server's updated_at), merged last-write-wins. Runs after local edits, when the
// app comes to the foreground, and on a retry timer while anything is waiting.
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

import {
  applyRemote,
  countDirty,
  currentUserId,
  dirtyRows,
  getMeta,
  isStoreOpen,
  markPushed,
  onLocalChange,
  setMeta,
} from './store';
import { COLUMNS, TABLES, type Rows, type TableName } from './types';

export type SyncStatus = {
  state: 'idle' | 'syncing' | 'offline';
  /** Local changes not on the server yet. */
  pending: number;
  lastSyncedAt: number | null;
};

let status: SyncStatus = { state: 'idle', pending: 0, lastSyncedAt: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  for (const l of listeners) l();
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}

const PAGE = 1000;
const PUSH_CHUNK = 200;
const PUSH_DELAY_MS = 1500;
const RETRY_MS = 30_000;

let running: Promise<void> | null = null;
let again = false;

/** Push then pull. Concurrent calls share one run (and queue one more). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runOnce();
    } while (again && isStoreOpen());
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runOnce() {
  if (!isStoreOpen()) return;
  setStatus({ state: 'syncing', pending: countDirty() });
  try {
    for (const t of TABLES) await push(t);
    for (const t of TABLES) await pull(t);
    setStatus({ state: 'idle', pending: countDirty(), lastSyncedAt: Date.now() });
  } catch (e) {
    if (__DEV__) console.log('[sync] failed, will retry:', e instanceof Error ? e.message : e);
    setStatus({ state: 'offline', pending: countDirty() });
  }
}

async function push(table: TableName) {
  const uid = currentUserId();
  // Global library rows are read-only for users; only push what we own.
  const rows = dirtyRows(table).filter((r) => (r as { owner_id: string | null }).owner_id === uid);
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
    const chunk = rows.slice(i, i + PUSH_CHUNK);
    // Only the synced columns: a field left on an old device row (e.g. a column the
    // server has since dropped) would otherwise fail the whole upsert.
    const cols = COLUMNS[table].split(', ');
    const body = chunk.map((row) =>
      Object.fromEntries(cols.filter((k) => k in row).map((k) => [k, (row as Record<string, unknown>)[k]])),
    );
    const { error } = await supabase.from(table).upsert(body as never, { onConflict: 'id' });
    if (error) throw new Error(`push ${table}: ${error.message}`);
    markPushed(table, chunk);
  }
}

async function pull(table: TableName) {
  const uid = currentUserId();
  const key = `pull:${table}`;
  const since = getMeta(key) ?? '1970-01-01T00:00:00Z';
  let newest = since;
  // Offset paging inside one run, so rows sharing an updated_at (bulk writes) aren't skipped.
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase.from(table).select(COLUMNS[table]).gt('updated_at', since);
    // RLS also lets friends' rows through; the device only keeps the user's own.
    q = table === 'exercises' ? q.or(`owner_id.is.null,owner_id.eq.${uid}`) : q.eq('owner_id', uid);
    const { data, error } = await q
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`pull ${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as (Rows[TableName] & { updated_at: string })[];
    if (rows.length === 0) break;
    for (const r of rows) if (r.updated_at > newest) newest = r.updated_at;
    applyRemote(
      table,
      rows.map(({ updated_at: _, ...r }) => r as Rows[typeof table]),
    );
    if (rows.length < PAGE) break;
  }
  if (newest !== since) setMeta(key, newest);
}

/** Wire up the triggers. Call once the store is open; returns a stop function. */
export function startSync(): () => void {
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  const offChange = onLocalChange(() => {
    setStatus({ pending: countDirty() });
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
  });
  const appState = AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncNow();
  });
  const retry = setInterval(() => {
    if (status.state === 'offline' || countDirty() > 0) void syncNow();
  }, RETRY_MS);
  // Web: retry as soon as the browser says it is back online.
  const online = () => void syncNow();
  const web = process.env.EXPO_OS === 'web';
  if (web) window.addEventListener('online', online);

  void syncNow();
  return () => {
    offChange();
    appState.remove();
    clearInterval(retry);
    if (pushTimer) clearTimeout(pushTimer);
    if (web) window.removeEventListener('online', online);
    status = { state: 'idle', pending: 0, lastSyncedAt: null };
  };
}
