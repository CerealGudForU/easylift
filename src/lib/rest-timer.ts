// The running rest timer. App-wide (not per screen) so it keeps counting when the
// workout is minimised, and timestamp-based so it's right after backgrounding.
import { useSyncExternalStore } from 'react';

export type Rest = { endsAt: number; total: number } | null;

let rest: Rest = null;
const listeners = new Set<() => void>();

function set(next: Rest) {
  rest = next;
  for (const l of listeners) l();
}

export const restTimer = {
  start: (seconds: number) => set({ endsAt: Date.now() + seconds * 1000, total: seconds }),
  adjust: (delta: number) =>
    rest && set({ endsAt: Math.max(Date.now(), rest.endsAt + delta * 1000), total: Math.max(1, rest.total + delta) }),
  stop: () => set(null),
};

export function useRest(): Rest {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => rest,
    () => rest,
  );
}
