// Shared state for the in-app updater: the Profile row and the update sheet read the same store.
import { useSyncExternalStore } from 'react';

import type { Release } from './updates-core';

export type UpdatePhase = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'installing' | 'error';

export type UpdateState = {
  phase: UpdatePhase;
  release?: Release;
  /** 0..1 while downloading; null when the size is unknown. */
  progress?: number | null;
  error?: string;
  /** Whether the update sheet is open. */
  sheet: boolean;
};

let state: UpdateState = { phase: 'idle', sheet: false };
const listeners = new Set<() => void>();

export function getUpdateState(): UpdateState {
  return state;
}

export function setUpdateState(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(subscribe, getUpdateState, getUpdateState);
}

export function closeUpdateSheet() {
  setUpdateState({ sheet: false });
}
