import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatClock, formatDelta } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { space, useColors } from '@/theme';

type Props = {
  startedAt: number;
  exercises: number;
  sets: number;
  /** Volume change vs the same exercises last time, e.g. 0.05 for +5%. Null when there is no history. */
  deltaVsLast: number | null;
  onMinimize: () => void;
  onFinish: () => void;
};

export function WorkoutHeader({ startedAt, exercises, sets, deltaVsLast, onMinimize, onFinish }: Props) {
  const c = useColors();
  const now = useNow(1000);

  // Green only for a real improvement; an unchanged 0% stays neutral (green means improved).
  const pct = deltaVsLast == null ? null : Math.round(deltaVsLast * 100);
  const deltaTone = pct == null ? 'textMuted' : pct > 0 ? 'successText' : pct < 0 ? 'textSecondary' : 'text';

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable onPress={onMinimize} hitSlop={12} accessibilityRole="button" accessibilityLabel="Minimize workout">
          <Icon name="chevron-down" size={28} color={c.textSecondary} />
        </Pressable>
        <Text variant="title" style={styles.timer} accessibilityLabel="Elapsed time">
          {formatClock((now - startedAt) / 1000)}
        </Text>
        <Button label="Finish" variant="primary" compact onPress={onFinish} />
      </View>
      <View style={styles.stats}>
        <Stat label="Exercises" value={String(exercises)} />
        <Stat label="Sets" value={String(sets)} />
        <Stat label="vs last" value={deltaVsLast == null ? '—' : formatDelta(deltaVsLast)} tone={deltaTone} />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tone = 'text',
}: {
  label: string;
  value: string;
  tone?: 'text' | 'successText' | 'textSecondary' | 'textMuted';
}) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" tone="textMuted">
        {label.toUpperCase()}
      </Text>
      <Text variant="stat" tone={tone}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timer: { fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
});
