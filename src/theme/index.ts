import { useColorScheme } from 'react-native';

import { palette, type ColorScheme, type Colors } from './tokens';

export * from './tokens';

/** Current Ember colors. Dark unless the system explicitly asks for light. */
export function useColors(): Colors {
  return palette[useScheme()];
}

export function useScheme(): ColorScheme {
  return useColorScheme() === 'light' ? 'light' : 'dark';
}
