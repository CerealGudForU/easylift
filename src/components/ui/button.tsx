import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { radius, size, space, useColors } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  icon?: IconName;
  compact?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, variant = 'secondary', icon, compact, loading, disabled, style, ...rest }: Props) {
  const c = useColors();
  const bg = { primary: c.accent, secondary: c.field, ghost: 'transparent', destructive: 'transparent' }[variant];
  const fg = { primary: c.onAccent, secondary: c.text, ghost: c.textSecondary, destructive: c.danger }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...rest}>
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={fg} /> : null}
        {icon && !loading ? <Icon name={icon} size={compact ? 16 : 20} color={fg} /> : null}
        <Text variant={compact ? 'label' : 'headline'} style={{ color: fg }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  regular: { minHeight: size.touch, paddingHorizontal: space.lg },
  compact: { minHeight: 36, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
