// On Android/iOS the local copy lives in SQLite: one row per record, so saving a
// set during a workout writes a few bytes instead of re-serialising whole tables.
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import type { Persist } from './persist-types';

export function openPersist(userId: string): Persist {
  const db: SQLiteDatabase = openDatabaseSync(`easylift-${userId}.db`);
  db.execSync(`
    pragma journal_mode = wal;
    create table if not exists rows (tbl text not null, id text not null, data text not null, primary key (tbl, id));
    create table if not exists meta (k text primary key, v text not null);
  `);

  return {
    loadAll() {
      const out: Record<string, unknown[]> = {};
      for (const r of db.getAllSync<{ tbl: string; data: string }>('select tbl, data from rows')) {
        (out[r.tbl] ??= []).push(JSON.parse(r.data));
      }
      return out;
    },
    save(changes) {
      const put = db.prepareSync('insert or replace into rows (tbl, id, data) values (?, ?, ?)');
      const del = db.prepareSync('delete from rows where tbl = ? and id = ?');
      try {
        db.withTransactionSync(() => {
          for (const { table, id, row } of changes) {
            if (row) put.executeSync(table, id, JSON.stringify(row));
            else del.executeSync(table, id);
          }
        });
      } finally {
        put.finalizeSync();
        del.finalizeSync();
      }
    },
    getMeta(k) {
      return db.getFirstSync<{ v: string }>('select v from meta where k = ?', k)?.v ?? null;
    },
    setMeta(k, v) {
      db.runSync('insert or replace into meta (k, v) values (?, ?)', k, v);
    },
    close() {
      db.closeSync();
    },
  };
}
