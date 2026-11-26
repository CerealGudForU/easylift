import type { ReactNode } from 'react';

// Native apps get correct insets from Expo Router's provider; see safe-area.tsx for web.
export function WebSafeArea({ children }: { children: ReactNode }) {
  return children;
}
