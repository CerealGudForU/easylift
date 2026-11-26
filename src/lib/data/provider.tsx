import { useEffect, useState } from 'react';

import { useSession } from '@/lib/session';

import { closeStore, openStore } from './store';
import { startSync } from './sync';

/**
 * Opens the signed-in user's local store and runs sync while they're signed in.
 * Returns true once the store is ready (always true when signed out).
 */
export function useDataReady(): boolean {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [openFor, setOpenFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      closeStore();
      return;
    }
    openStore(userId);
    const stop = startSync();
    // Store opening is synchronous, so the data is there by the time we render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenFor(userId);
    return () => {
      stop();
      closeStore();
    };
  }, [userId]);

  return !userId || openFor === userId;
}
