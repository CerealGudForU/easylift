// A finished workout: the summary right after Finish (finished=1), and the detail
// view from history.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { setLabels } from '@/components/workout/types';
import { deleteWorkout, renameWorkout } from '@/lib/data/actions';
import { exercisesOf, newBests, setsOf, useWorkoutData, workoutStats } from '@/lib/data/queries';
import { equipmentLabel } from '@/lib/exercise-labels';
import { formatDuration, formatNumber, formatWorkoutDate } from '@/lib/format';
import { fonts, radius, size, space, useColors } from '@/theme';

export default function WorkoutDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id, finished } = useLocalSearchParams<{ id: string; finished?: string }>();
  const data = useWorkoutData();
  const [menu, setMenu] = useState(false);
  const justFinished = finished === '1';
  const typedTitle = useRef<string | null>(null);
  const commitTitle = () => {
    if (typedTitle.current != null) renameWorkout(id, typedTitle.current);
    typedTitle.current = null;
  };

  const view = useMemo(() => {
    const w = data.w.get(id);
    if (!w || w.deleted_at) return null;
    return {
      workout: w,
      stats: workoutStats(id),
      bests: newBests(id),
      exercises: exercisesOf(id).map((we) => {
        const sets = setsOf(we.id).filter((s) => s.completed_at);
        const ex = data.e.get(we.exercise_id);
        return { id: we.id, name: ex?.name ?? 'Exercise', equipment: ex?.equipment ?? null, sets };
      }),
    };
  }, [data, id]);

  const close = () => (justFinished || !router.canGoBack() ? router.replace('/workout') : router.back());

  if (!view) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: c.bg }]}>
        <Text variant="body" tone="textSecondary">
          This workout was deleted.
        </Text>
        <Button label="Back" onPress={close} />
      </View>
    );
  }
  const { workout, stats, bests } = view;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        {justFinished ? (
          <View style={styles.flex} />
        ) : (
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.flex}>
            <Icon name="arrow-left" size={26} color={c.textSecondary} />
          </Pressable>
        )}
        {justFinished ? (
          <Button label="Done" variant="primary" compact onPress={close} />
        ) : (
          <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Workout options">
            <Icon name="dots-vertical" size={24} color={c.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        {justFinished ? (
          <View style={styles.hero}>
            <View style={[styles.badge, { backgroundColor: c.successBg }]}>
              <Icon name="check-bold" size={30} color={c.successText} />
            </View>
            <Text variant="display">Workout done</Text>
          </View>
        ) : null}

        <View style={styles.titleBlock}>
          <TextInput
            defaultValue={workout.title}
            onChangeText={(t) => (typedTitle.current = t)}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            returnKeyType="done"
            maxLength={80}
            accessibilityLabel="Workout name"
            selectionColor={c.accent}
            cursorColor={c.accent}
            style={[styles.titleInput, { color: c.text }]}
          />
          <Text variant="label" tone="textMuted">
            {formatWorkoutDate(workout.started_at)}
          </Text>
        </View>

        <View style={[styles.stats, { backgroundColor: c.surface }]}>
          <Stat label="Duration" value={formatDuration(stats.durationS)} />
          <Stat label="Volume" value={`${formatNumber(Math.round(stats.volumeKg))} kg`} />
          <Stat label="Sets" value={String(stats.sets)} />
        </View>

        {bests.length ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <Text variant="caption" tone="textSecondary">
              NEW BESTS
            </Text>
            {bests.map((b) => (
              <View key={b.exerciseId + b.kind} style={styles.bestRow}>
                <Icon name="trophy" size={20} color={c.accent} />
                <Text variant="body" style={styles.flex} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text variant="stat">
                  {b.kind === 'weight' ? `${formatNumber(b.value)} kg` : `${formatNumber(b.value)} kg e1RM`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {view.exercises.map((x) => {
          const labels = setLabels(x.sets.map((s) => ({ id: s.id, type: s.set_type, weightKg: null, reps: null, done: true })));
          return (
            <View key={x.id} style={[styles.card, { backgroundColor: c.surface }]}>
              <View>
                <Text variant="exercise" tone="accent" numberOfLines={2}>
                  {x.name}
                </Text>
                <Text variant="label" tone="textMuted">
                  {equipmentLabel(x.equipment)}
                </Text>
              </View>
              {x.sets.map((s, i) => (
                <View key={s.id} style={styles.setRow}>
                  <Text
                    variant="numeric"
                    style={[
                      styles.setLabel,
                      {
                        color:
                          s.set_type === 'warmup'
                            ? c.setWarmup
                            : s.set_type === 'failure'
                              ? c.danger
                              : s.set_type === 'drop'
                                ? c.setDrop
                                : c.textSecondary,
                      },
                    ]}>
                    {labels[i]}
                  </Text>
                  <Text variant="numeric">
                    {s.weight_kg ? `${formatNumber(s.weight_kg)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <ActionSheet
        visible={menu}
        title={workout.title}
        actions={[
          {
            label: 'Delete workout',
            icon: 'trash-can-outline',
            destructive: true,
            onPress: () => {
              deleteWorkout(workout.id);
              close();
            },
          },
        ]}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" tone="textMuted">
        {label.toUpperCase()}
      </Text>
      <Text variant="stat">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: size.touch },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: space.md, paddingVertical: space.md },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { gap: 2 },
  titleInput: { fontFamily: fonts.condensedBold, fontSize: 26, lineHeight: 30, padding: 0, outlineWidth: 0 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: radius.card, paddingVertical: space.lg },
  stat: { alignItems: 'center', gap: 2 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.sm },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  setLabel: { width: 28, fontSize: 18, textAlign: 'center' },
});
