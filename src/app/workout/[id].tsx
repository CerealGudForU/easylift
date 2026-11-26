// A finished workout: the summary right after Finish (finished=1), and the detail
// view from history.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutPhotos } from '@/components/social/workout-photo';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { setLabels } from '@/components/workout/types';
import { deleteWorkout, renameWorkout, setWorkoutVisibility } from '@/lib/data/actions';
import { exercisesOf, newBests, setsOf, useWorkoutData, workoutStats } from '@/lib/data/queries';
import { equipmentLabel } from '@/lib/exercise-labels';
import { formatDuration, formatNumber, formatWorkoutDate } from '@/lib/format';
import { formatMetric, formatRecordSet, RECORD_LABEL } from '@/lib/progress-labels';
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
        return { id: we.id, exerciseId: we.exercise_id, name: ex?.name ?? 'Exercise', equipment: ex?.equipment ?? null, sets };
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
        <Pressable
          onPress={() => router.push({ pathname: '/share/[id]', params: { id } })}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Share workout">
          <Icon name="share-variant" size={24} color={c.textSecondary} />
        </Pressable>
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

        <WorkoutPhotos workoutId={workout.id} />

        <Pressable
          onPress={() => setWorkoutVisibility(workout.id, workout.visibility === 'private' ? 'friends' : 'private')}
          accessibilityRole="switch"
          accessibilityState={{ checked: workout.visibility !== 'private' }}
          accessibilityLabel="Show in your friends' feed"
          style={({ pressed }) => [styles.visibility, { backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
          <Icon
            name={workout.visibility === 'private' ? 'lock-outline' : 'account-group-outline'}
            size={22}
            color={workout.visibility === 'private' ? c.textSecondary : c.accent}
          />
          <View style={styles.flex}>
            <Text variant="headline">{workout.visibility === 'private' ? 'Only you' : 'Friends can see this'}</Text>
            <Text variant="label" tone="textMuted">
              {workout.visibility === 'private'
                ? 'Hidden from the feed. Tap to share with friends.'
                : "In your friends' feed. Tap to make it private."}
            </Text>
          </View>
        </Pressable>

        <View style={[styles.stats, { backgroundColor: c.surface }]}>
          <Stat label="Duration" value={formatDuration(stats.durationS)} />
          <Stat label="Volume" value={`${formatNumber(Math.round(stats.volumeKg))} kg`} />
          <Stat label="Sets" value={String(stats.sets)} />
        </View>

        {bests.length ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.bestHead}>
              <Icon name="trophy" size={20} color={c.accent} />
              <Text variant="caption" tone="textSecondary">
                {bests.length === 1 ? 'NEW PERSONAL RECORD' : `${bests.length} NEW PERSONAL RECORDS`}
              </Text>
            </View>
            {bests.map((b, i) => (
              <Pressable
                key={b.exerciseId + b.kind}
                onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: b.exerciseId } })}
                accessibilityRole="button"
                accessibilityLabel={`${b.name}, ${RECORD_LABEL[b.kind]} ${formatMetric(b.kind, b.value)}`}
                style={({ pressed }) => [styles.bestRow, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.flex}>
                  {i === 0 || bests[i - 1].exerciseId !== b.exerciseId ? (
                    <Text variant="headline" numberOfLines={1}>
                      {b.name}
                    </Text>
                  ) : null}
                  <Text variant="label" tone="textSecondary">
                    {RECORD_LABEL[b.kind]}
                    {formatRecordSet(b) ? ` · ${formatRecordSet(b)}` : ''}
                  </Text>
                </View>
                <Text variant="stat">{formatMetric(b.kind, b.value)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {view.exercises.map((x) => {
          const labels = setLabels(x.sets.map((s) => ({ id: s.id, type: s.set_type, weightKg: null, reps: null, done: true })));
          return (
            <View key={x.id} style={[styles.card, { backgroundColor: c.surface }]}>
              <Pressable
                onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: x.exerciseId } })}
                accessibilityRole="button"
                accessibilityLabel={`${x.name}, see progress`}
                style={({ pressed }) => [styles.exHead, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.flex}>
                  <Text variant="exercise" tone="accent" numberOfLines={2}>
                    {x.name}
                  </Text>
                  <Text variant="label" tone="textMuted">
                    {equipmentLabel(x.equipment)}
                  </Text>
                </View>
                <Icon name="chart-line" size={20} color={c.textMuted} />
              </Pressable>
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
  visibility: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    padding: space.md,
    minHeight: 64,
  },
  stat: { alignItems: 'center', gap: 2 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.sm },
  bestHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  setLabel: { width: 28, fontSize: 18, textAlign: 'center' },
});
