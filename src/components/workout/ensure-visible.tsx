import { createContext, useContext, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';

export type ViewRef = ComponentRef<typeof View>;

/** Lets a child (the open set) ask the workout ScrollView to bring it fully into view. */
export const EnsureVisibleContext = createContext<(ref: RefObject<ViewRef | null>) => void>(() => {});

export function useEnsureVisible() {
  return useContext(EnsureVisibleContext);
}
