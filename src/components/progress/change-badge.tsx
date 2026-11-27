// A 30-day change in an exercise's heaviest weight: green when up, red when down, grey at 0 %.
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { RecentChange } from '@/lib/progress';
import { useColors } from '@/theme';

export function changeText(pct: number): string {
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export function ChangeBadge({ change, suffix = '', size = 'small' }: { change: RecentChange; suffix?: string; size?: 'small' | 'large' }) {
  const c = useColors();
  const { pct } = change;
  const color = pct > 0 ? c.successText : pct < 0 ? c.danger : c.textMuted;
  const icon = pct > 0 ? 'arrow-top-right' : pct < 0 ? 'arrow-bottom-right' : 'arrow-right';
  const what = change.metric === 'weight' ? 'heaviest weight' : 'most reps';
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${what} ${pct === 0 ? 'unchanged' : `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)} percent`} in the last 30 days`}>
      <Icon name={icon} size={size === 'large' ? 20 : 16} color={color} />
      <Text variant={size === 'large' ? 'headline' : 'label'} style={{ color }}>
        {changeText(pct)}
        {suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
