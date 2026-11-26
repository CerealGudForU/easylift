// The device's copy of the signed-in user's data. The UI only ever reads and
// writes here, so everything works offline; sync.ts moves changes to and from
// Supabase in the background.
//
// Each table is an immutable Map (replaced on change) so React can subscribe with
// useSyncExternalStore. Local edits stamp client_updated_at and set _dirty; deletes
// become tombstones (deleted_at) until the server has them.
import { useSyncExternalStore } from 'react';

import { openPersist } from './persist';
import type { Change, Persist } from './persist-types';
import { TABLES, type Local, type Rows, type TableName } from './types';

type Tables = { [K in TableName]: ReadonlyMap<string, Local<Rows[K]>> };

type State = {
  userId: string;
  persist: Persist;
  tables: Tables;
};

let state: State | null = null;
const listeners = new Set<() => void>();
const dirtyListeners = new Set<() => void>();
let pending: Change[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const emptyTables = (): Tables =>
  Object.fromEntries(TABLES.map((t) => [t, new Map()])) as unknown as Tables;

export function openStore(userId: string) {
  if (state?.userId === userId) return;
  closeStore();
  const persist = openPersist(userId);
  const tables = emptyTables();
  const stored = persist.loadAll();
  for (const t of TABLES) {
    const m = new Map<string, Local<Rows[typeof t]>>();
    for (const row of (stored[t] ?? []) as Local<Rows[typeof t]>[]) m.set(row.id, row);
    (tables as Record<TableName, unknown>)[t] = m;
  }
  state = { userId, persist, tables };
  emit();
}

export function closeStore() {
  if (!state) return;
  flush();
  state.persist.close();
  state = null;
  emit();
}

export const isStoreOpen = () => state !== null;

export function currentUserId(): string {
  if (!state) throw new Error('store is not open');
  return state.userId;
}

export function getMeta(key: string) {
  return state?.persist.getMeta(key) ?? null;
}
export function setMeta(key: string, value: string) {
  state?.persist.setMeta(key, value);
}

function emit() {
  for (const l of listeners) l();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 200);
}

/** Write pending changes to device storage now (also runs on close). */
export function flush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!state || pending.length === 0) return;
  const batch = pending;
  pending = [];
  state.persist.save(batch);
}

// --- Reading -------------------------------------------------------------------

export function getTable<K extends TableName>(name: K): Tables[K] {
  return (state?.tables[name] ?? EMPTY) as unknown as Tables[K];
}
const EMPTY: ReadonlyMap<string, unknown> = new Map();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The whole table, including tombstones. Re-renders when it changes. */
export function useTable<K extends TableName>(name: K): Tables[K] {
  return useSyncExternalStore(subscribe, () => getTable(name), () => getTable(name));
}

const liveCache = new WeakMap<ReadonlyMap<string, unknown>, unknown[]>();
/** Rows that aren't deleted, as a stable array per table version. Don't mutate it. */
export function liveRows<T extends { deleted_at: string | null }>(table: ReadonlyMap<string, T>): T[] {
  let rows = liveCache.get(table) as T[] | undefined;
  if (!rows) {
    rows = [...table.values()].filter((r) => !r.deleted_at);
    liveCache.set(table, rows);
  }
  return rows;
}
export const useRows = <K extends TableName>(name: K) => liveRows(useTable(name));

// --- Writing -------------------------------------------------------------------

type Tx = {
  /** Insert or replace a whole row (owner_id etc. included). */
  put<K extends TableName>(table: K, row: Omit<Rows[K], 'client_updated_at' | 'deleted_at'> & Partial<Rows[K]>): void;
  patch<K extends TableName>(table: K, id: string, patch: Partial<Rows[K]>): void;
  /** Tombstone a row so the delete syncs. */
  remove(table: TableName, id: string): void;
};

/** Apply local edits as one batch: one re-render, one storage write. */
export function write(fn: (tx: Tx) => void) {
  if (!state) return;
  const s = state;
  const now = new Date().toISOString();
  const cloned = new Set<TableName>();
  const mutable = <K extends TableName>(t: K) => {
    if (!cloned.has(t)) {
      (s.tables as Record<TableName, unknown>)[t] = new Map(s.tables[t]);
      cloned.add(t);
    }
    return s.tables[t] as unknown as Map<string, Local<Rows[K]>>;
  };
  const set = <K extends TableName>(t: K, row: Local<Rows[K]>) => {
    mutable(t).set(row.id, row);
    pending.push({ table: t, id: row.id, row });
  };

  fn({
    put(t, row) {
      set(t, { deleted_at: null, ...row, client_updated_at: now, _dirty: 1 } as unknown as Local<Rows[typeof t]>);
    },
    patch(t, id, patch) {
      const old = s.tables[t].get(id);
      if (!old) return;
      set(t, { ...old, ...patch, client_updated_at: now, _dirty: 1 });
    },
    remove(t, id) {
      const old = s.tables[t].get(id);
      if (!old || old.deleted_at) return;
      set(t, { ...old, deleted_at: now, client_updated_at: now, _dirty: 1 });
    },
  });

  if (cloned.size === 0) return;
  scheduleFlush();
  emit();
  for (const l of dirtyListeners) l();
}

/** sync.ts subscribes to push soon after local edits. */
export function onLocalChange(l: () => void) {
  dirtyListeners.add(l);
  return () => {
    dirtyListeners.delete(l);
  };
}

// --- Used by sync ----------------------------------------------------------------

export function dirtyRows<K extends TableName>(name: K): Local<Rows[K]>[] {
  return [...getTable(name).values()].filter((r) => r._dirty);
}

export function countDirty(): number {
  let n = 0;
  for (const t of TABLES) for (const r of getTable(t).values()) if (r._dirty) n++;
  return n;
}

/** After a push: clear _dirty on rows that haven't been edited again since. */
export function markPushed<K extends TableName>(name: K, pushed: { id: string; client_updated_at: string }[]) {
  if (!state || pushed.length === 0) return;
  const m = new Map(state.tables[name]);
  for (const p of pushed) {
    const cur = m.get(p.id);
    if (!cur || cur.client_updated_at !== p.client_updated_at) continue;
    if (cur.deleted_at) {
      m.delete(p.id);
      pending.push({ table: name, id: p.id, row: null });
    } else {
      const { _dirty: _, ...clean } = cur;
      m.set(p.id, clean as Local<Rows[K]>);
      pending.push({ table: name, id: p.id, row: clean });
    }
  }
  (state.tables as Record<TableName, unknown>)[name] = m;
  scheduleFlush();
  emit();
}

/**
 * Merge rows pulled from the server. Last write wins on client_updated_at: a local
 * edit that is newer than the server's copy is kept (and will be pushed).
 */
export function applyRemote<K extends TableName>(name: K, rows: Rows[K][]) {
  if (!state || rows.length === 0) return;
  const m = new Map(state.tables[name]);
  let changed = false;
  for (const remote of rows) {
    const local = m.get(remote.id);
    if (local?._dirty && local.client_updated_at >= remote.client_updated_at) continue;
    changed = true;
    if (remote.deleted_at) {
      m.delete(remote.id);
      pending.push({ table: name, id: remote.id, row: null });
    } else {
      m.set(remote.id, remote);
      pending.push({ table: name, id: remote.id, row: remote });
    }
  }
  if (!changed) return;
  (state.tables as Record<TableName, unknown>)[name] = m;
  scheduleFlush();
  emit();
}

// --- Ids -------------------------------------------------------------------------

/** RFC 4122 v4. Rows get their ids on the device so offline rows never need remapping. */
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
