// Hands the exercise picker's selection back to the routine editor (which keeps an
// unsaved draft, so the picker can't write to the store directly).
let pending: string[] | null = null;

export const pickResult = {
  set: (ids: string[]) => {
    pending = ids;
  },
  /** Returns the selection once, then clears it. */
  take: (): string[] | null => {
    const ids = pending;
    pending = null;
    return ids;
  },
};
