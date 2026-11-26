// Workout tab: start an empty workout or one from a routine, and manage routines.
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { startWorkout } from '@/lib/data/actions';
import { byPosition } from '@/lib/data/order';
import { useActiveWorkout } from '@/lib/data/queries';
import { liveRows, useTable } from '@/lib/data/store';
import { radius, size, space, useColors } from '@/theme';

export default function WorkoutTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const active = useActiveWorkout();
  const routinesT = useTable('routines');
  const rexT = useTable('routine_exercises');
  const rsetT = useTable('routine_sets');
  const exT = useTable('exercises');

  const routines = useMemo(() => {
    const rex = liveRows(rexT);
    const sets = liveRows(rsetT);
    return [...liveRows(routinesT)]
      .sort(byPosition)
      .map((r) => {
        const mine = rex.filter((x) => x.routine_id === r.id).sort(byPosition);
        const ids = new Set(mine.map((x) => x.id));
        return {
          id: r.id,
          name: r.name,
          summary: mine.map((x) => exT.get(x.exercise_id)?.name ?? 'Exercise').join(', '),
          sets: sets.filter((s) => ids.has(s.routine_exercise_id)).length,
        };
      });
  }, [routinesT, rexT, rsetT, exT]);

  const start = (routineId?: string) => {
    startWorkout(routineId);
    router.push('/workout/active');
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: active ? space.huge : 112 }]}>
      <Text variant="title">Workout</Text>

      {active ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent, borderWidth: 1 }]}>
          <Text variant="caption" tone="accent">
            IN PROGRESS
          </Text>
          <Text variant="headline">{active.title}</Text>
          <Button label="Resume workout" variant="primary" icon="play" onPress={() => router.push('/workout/active')} />
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text variant="headline">Routines</Text>
        <Button
          label="New routine"
          icon="plus"
          compact
          // Straight to choosing exercises; the name is optional and comes after.
          onPress={() => router.push({ pathname: '/exercises/pick', params: { for: 'routine', new: '1' } })}
        />
      </View>

      {routines.length === 0 ? (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: c.surface }]}>
          <Icon name="clipboard-text-outline" size={28} color={c.accent} />
          <Text variant="body" tone="textSecondary" style={styles.center}>
            Save the workouts you repeat as routines, then start them in one tap.
          </Text>
        </View>
      ) : (
        routines.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: c.surface }]}>
            <Pressable
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${r.name}`}
              style={({ pressed }) => [styles.routineInfo, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={styles.routineHead}>
              <Text variant="headline" style={styles.flex} numberOfLines={1}>
                {r.name}
              </Text>
                <Icon name="pencil-outline" size={18} color={c.textMuted} />
              </View>
              <Text variant="label" tone="textSecondary" numberOfLines={2}>
                {r.summary || 'No exercises'}
              </Text>
              <Text variant="caption" tone="textMuted">
                {r.sets} {r.sets === 1 ? 'SET' : 'SETS'}
              </Text>
            </Pressable>
            {!active ? (
              <Button label="Start routine" variant="secondary" icon="play" onPress={() => start(r.id)} />
            ) : null}
          </View>
        ))
      )}
    </ScrollView>

    {/* Floating start button. While a workout is running, the in-progress card and bar replace it. */}
    {!active ? (
      <Pressable
        onPress={() => start()}
        accessibilityRole="button"
        accessibilityLabel="Start workout"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}>
        <Icon name="play" size={24} color={c.onAccent} />
        <Text variant="headline" style={{ color: c.onAccent }}>
          Start Workout
        </Text>
      </Pressable>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  fab: {
    position: 'absolute',
    bottom: space.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.xxl,
    borderRadius: radius.pill,
    boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
  },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.sm },
  emptyCard: { alignItems: 'center', gap: space.md },
  center: { textAlign: 'center' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
    minHeight: size.touch,
  },
  routineInfo: { gap: space.sm },
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
