// On web the local copy lives in localStorage, one JSON blob per table.
// (expo-sqlite on web needs cross-origin isolation headers; not worth it here.)
import type { Persist } from './persist-types';

export function openPersist(userId: string): Persist {
  const prefix = `easylift:${userId}:`;
  const cache: Record<string, Record<string, unknown>> = {};

  const read = (table: string) => {
    if (!cache[table]) {
      try {
        cache[table] = JSON.parse(window.localStorage.getItem(prefix + 't:' + table) ?? '{}');
      } catch {
        cache[table] = {};
      }
    }
    return cache[table];
  };

  return {
    loadAll() {
      const out: Record<string, unknown[]> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(prefix + 't:')) {
          const table = key.slice(prefix.length + 2);
          out[table] = Object.values(read(table));
        }
      }
      return out;
    },
    save(changes) {
      const touched = new Set<string>();
      for (const { table, id, row } of changes) {
        const t = read(table);
        if (row) t[id] = row;
        else delete t[id];
        touched.add(table);
      }
      for (const table of touched) {
        try {
          window.localStorage.setItem(prefix + 't:' + table, JSON.stringify(cache[table]));
        } catch (e) {
          console.warn('[easylift] could not save locally', e);
        }
      }
    },
    getMeta(k) {
      return window.localStorage.getItem(prefix + 'm:' + k);
    },
    setMeta(k, v) {
      window.localStorage.setItem(prefix + 'm:' + k, v);
    },
    close() {},
  };
}
