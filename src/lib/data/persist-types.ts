export type Change = { table: string; id: string; row: unknown | null };

/** Device storage for the local copy of the user's data (one per signed-in user). */
export type Persist = {
  /** Every stored row, grouped by table. */
  loadAll(): Record<string, unknown[]>;
  /** `row: null` deletes. */
  save(changes: Change[]): void;
  getMeta(key: string): string | null;
  setMeta(key: string, value: string): void;
  close(): void;
};
