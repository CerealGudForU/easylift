// Ember design tokens. Rules and rationale: design/MASTER.md
import type { TextStyle } from 'react-native';

export const palette = {
  dark: {
    bg: '#0A0A0A',
    surface: '#141414',
    surfaceRaised: '#1C1C1C',
    field: '#1F1F1F',
    border: '#262626',
    text: '#FAFAFA',
    textSecondary: '#A3A3A3',
    textMuted: '#8A8A8A',
    accent: '#F97316',
    onAccent: '#1A0E05',
    success: '#16A34A',
    onSuccess: '#FFFFFF',
    successBg: '#122B1A',
    successText: '#22C55E',
    danger: '#EF4444',
    setWarmup: '#F5A524',
    setDrop: '#60A5FA',
  },
  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    field: '#F0F0F0',
    border: '#E5E5E5',
    text: '#0A0A0A',
    textSecondary: '#525252',
    textMuted: '#737373',
    accent: '#EA580C',
    onAccent: '#FFFFFF',
    success: '#16A34A',
    onSuccess: '#FFFFFF',
    successBg: '#DCFCE7',
    successText: '#15803D',
    danger: '#DC2626',
    setWarmup: '#B45309',
    setDrop: '#2563EB',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type Colors = { [K in keyof (typeof palette)['dark']]: string };

// Family names match the embedded .ttf file names (Android) and the useFonts keys (web).
export const fonts = {
  condensedSemiBold: 'BarlowCondensed_600SemiBold',
  condensedBold: 'BarlowCondensed_700Bold',
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semiBold: 'Barlow_600SemiBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const type = {
  display: { fontFamily: fonts.condensedBold, fontSize: 34, lineHeight: 38, fontVariant: tabular },
  title: { fontFamily: fonts.condensedBold, fontSize: 26, lineHeight: 30 },
  exercise: {
    fontFamily: fonts.condensedBold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  numeric: { fontFamily: fonts.condensedBold, fontSize: 22, lineHeight: 26, fontVariant: tabular },
  stat: { fontFamily: fonts.condensedSemiBold, fontSize: 18, lineHeight: 22, fontVariant: tabular },
  headline: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40 } as const;

// Shape lock: fields/buttons 10, cards/sheets 16, chips are pills.
export const radius = { control: 10, card: 16, pill: 999 } as const;

export const size = { touch: 48, setRow: 56, setField: 48, setFieldMinWidth: 64 } as const;

export const motion = { press: 100, complete: 150 } as const;
