import { Pressable, StyleSheet } from 'react-native';

import { radius, space, useColors } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type Props = { label: string; icon?: IconName; muted?: boolean; selected?: boolean; onPress?: () => void };

export function Chip({ label, icon, muted, selected, onPress }: Props) {
  const c = useColors();
  const fg = selected ? c.onAccent : muted ? c.textSecondary : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.accent : c.field, opacity: pressed ? 0.75 : 1 },
      ]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
});
