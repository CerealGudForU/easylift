import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useActiveWorkout } from '@/lib/data/queries';
import { formatClock } from '@/lib/format';
import { useRest } from '@/lib/rest-timer';
import { useNow } from '@/lib/use-now';
import { radius, size, space, useColors } from '@/theme';

/** "Workout in progress" bar above the tab bar while a workout is minimised. */
export function ActiveWorkoutBar() {
  const active = useActiveWorkout();
  return active ? <Bar title={active.title} startedAt={Date.parse(active.started_at)} /> : null;
}

function Bar({ title, startedAt }: { title: string; startedAt: number }) {
  const c = useColors();
  const now = useNow(1000);
  const rest = useRest();
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  return (
    <View style={[styles.wrap, { backgroundColor: c.surfaceRaised, borderTopColor: c.border }]}>
      <Pressable
        onPress={() => router.push('/workout/active')}
        accessibilityRole="button"
        accessibilityLabel={`Workout in progress, ${title}. Open`}
        style={({ pressed }) => [styles.bar, { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="dumbbell" size={20} color={c.onAccent} />
        <View style={styles.flex}>
          <Text variant="label" style={{ color: c.onAccent }} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="stat" style={{ color: c.onAccent }}>
            {formatClock((now - startedAt) / 1000)}
            {restLeft > 0 ? `  ·  Rest ${formatClock(restLeft)}` : ''}
          </Text>
        </View>
        <Icon name="chevron-up" size={24} color={c.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.touch + 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderCurve: 'continuous',
  },
  flex: { flex: 1 },
});
