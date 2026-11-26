import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type SessionState = { session: Session | null; loading: boolean };

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    // Fires INITIAL_SESSION straight away (from storage), then on every sign-in/out/refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

/** The signed-in user's username (from sign-up metadata). */
export function useUsername(): string | null {
  const { session } = useSession();
  const u = session?.user.user_metadata?.username;
  return typeof u === 'string' ? u : null;
}
