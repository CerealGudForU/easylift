import { Text as RNText, type TextProps } from 'react-native';

import { type Colors, type TypeVariant, type as typeScale, useColors } from '@/theme';

type Props = TextProps & {
  variant?: TypeVariant;
  /** A color token name. Defaults to `text`. */
  tone?: keyof Colors;
};

export function Text({ variant = 'body', tone = 'text', style, ...rest }: Props) {
  const colors = useColors();
  return <RNText style={[typeScale[variant], { color: colors[tone] }, style]} {...rest} />;
}
