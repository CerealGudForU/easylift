// The workout in progress. Everything is saved to the device as you go (and synced),
// so minimising, closing the app or losing signal never loses a set.
import { Redirect, router } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { EnsureVisibleContext, type ViewRef } from '@/components/workout/ensure-visible';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { RestTimerBar } from '@/components/workout/rest-timer-bar';
import type { WorkoutExercise } from '@/components/workout/types';
import { WorkoutHeader } from '@/components/workout/workout-header';
import {
  addSet,
  cycleSetType,
  deleteWorkout,
  finishWorkout,
  moveWorkoutExercise,
  removeSet,
  removeWorkoutExercise,
  setDone,
  setRestSeconds,
  updateSet,
} from '@/lib/data/actions';
import { exercisesOf, lastPerformance, setsOf, useActiveWorkout, useWorkoutData } from '@/lib/data/queries';
import { equipmentLabel } from '@/lib/exercise-labels';
import { restTimer, useRest } from '@/lib/rest-timer';
import { space, useColors } from '@/theme';

/** chosenId value meaning "no set open" (the user closed it). */
const COLLAPSED = '__collapsed__';

function nextUndoneAfter(exercises: WorkoutExercise[], setId: string): string | null {
  const all = exercises.flatMap((x) => x.sets);
  const i = all.findIndex((s) => s.id === setId);
  const after = all.slice(i + 1).find((s) => !s.done);
  const before = all.slice(0, i).find((s) => !s.done);
  return (after ?? before)?.id ?? null;
}

type Sheet = { title?: string; message?: string; actions: SheetAction[] } | null;

export default function ActiveWorkoutScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const active = useActiveWorkout();
  const data = useWorkoutData();
  const rest = useRest();
  const [sheet, setSheet] = useState<Sheet>(null);
  // Set when finishing/discarding, so the screen doesn't redirect while it navigates away.
  const [leaving, setLeaving] = useState(false);

  const exercises: WorkoutExercise[] = useMemo(() => {
    void data; // recompute whenever workout data changes
    if (!active) return [];
    return exercisesOf(active.id).map((we) => {
      const ex = data.e.get(we.exercise_id);
      const last = lastPerformance(we.exercise_id, active.id);
      return {
        id: we.id,
        name: ex?.name ?? 'Exercise',
        equipment: equipmentLabel(ex?.equipment ?? null),
        restSeconds: we.rest_seconds ?? 90,
        sets: (() => {
          // A set with no history is suggested the values of the set above it (its own
          // values, or what it was suggested). Warm-ups only feed other warm-ups.
          const carry: Partial<Record<'warmup' | 'work', { weightKg: number; reps: number }>> = {};
          return setsOf(we.id).map((s, i) => {
            const p = last?.sets[i];
            const previous = p && p.reps != null ? { weightKg: p.weight_kg ?? 0, reps: p.reps } : undefined;
            const kind = s.set_type === 'warmup' ? 'warmup' : 'work';
            const hint = carry[kind];
            const own = s.reps != null ? { weightKg: s.weight_kg ?? 0, reps: s.reps } : undefined;
            const shown = own ?? previous ?? hint;
            if (shown) carry[kind] = shown;
            return {
              id: s.id,
              type: s.set_type,
              weightKg: s.weight_kg,
              reps: s.reps,
              done: !!s.completed_at,
              previous,
              hint,
            };
          });
        })(),
      };
    });
  }, [active, data]);

  const { volume, doneSets, prevVolume } = useMemo(() => {
    let volume = 0;
    let doneSets = 0;
    let prevVolume = 0;
    for (const x of exercises)
      for (const s of x.sets)
        if (s.done) {
          doneSets++;
          volume += (s.weightKg ?? 0) * (s.reps ?? 0);
          if (s.previous) prevVolume += s.previous.weightKg * s.previous.reps;
        }
    return { volume, doneSets, prevVolume };
  }, [exercises]);

  const [chosenId, setChosenId] = useState<string | null>(null);
  const nextUndoneId = useMemo(() => {
    for (const x of exercises) for (const s of x.sets) if (!s.done) return s.id;
    return null;
  }, [exercises]);
  const expandedId = chosenId === COLLAPSED ? null : (chosenId ?? nextUndoneId);

  const toggleSet = (x: WorkoutExercise, setId: string, fromPanel: boolean) => {
    const s = x.sets.find((it) => it.id === setId);
    if (!s) return;
    const completing = !s.done;
    const suggest = s.previous ?? s.hint;
    const weightKg = s.weightKg ?? suggest?.weightKg ?? null;
    const reps = s.reps ?? suggest?.reps ?? null;
    // A checkbox on a set with nothing to log opens it instead.
    if (completing && !fromPanel && reps == null) {
      setChosenId(setId);
      return;
    }
    setDone(setId, completing, { weightKg: weightKg ?? 0, reps: reps ?? 0 });
    if (fromPanel) setChosenId(completing ? nextUndoneAfter(exercises, setId) : setId);
    else setChosenId(expandedId ?? COLLAPSED);
    // Drop sets chain straight into the next set, so they don't start rest.
    if (completing && s.type !== 'drop' && x.restSeconds > 0) restTimer.start(x.restSeconds);
  };

  // Scroll the open set fully into view, keeping clear of the rest bar at the bottom.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ViewRef>(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const ensureVisible = useCallback((ref: RefObject<ViewRef | null>) => {
    const target = ref.current;
    const content = contentRef.current;
    if (!target || !content) return;
    target.measureLayout(content, (_x, y, _w, h) => {
      const top = y + space.lg;
      const bottomReserve = 150;
      const visibleBottom = scrollY.current + viewportH.current - bottomReserve;
      if (top + h > visibleBottom) {
        scrollRef.current?.scrollTo({ y: top + h - viewportH.current + bottomReserve, animated: true });
      } else if (top < scrollY.current) {
        scrollRef.current?.scrollTo({ y: Math.max(0, top - space.md), animated: true });
      }
    });
  }, []);

  if (!active) return leaving ? null : <Redirect href="/workout" />;
  const workoutId = active.id;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/workout'));

  const finish = () => {
    setLeaving(true);
    restTimer.stop();
    finishWorkout(workoutId);
    router.replace({ pathname: '/workout/[id]', params: { id: workoutId, finished: '1' } });
  };

  const onFinish = () => {
    const undone = exercises.reduce((n, x) => n + x.sets.filter((s) => !s.done).length, 0);
    if (doneSets === 0) {
      setSheet({
        title: 'Nothing logged yet',
        message: 'Complete at least one set to save this workout, or discard it.',
        actions: [{ label: 'Discard workout', icon: 'trash-can-outline', destructive: true, onPress: discard }],
      });
    } else if (undone > 0) {
      setSheet({
        title: 'Finish workout?',
        message: `${undone} unfinished ${undone === 1 ? 'set' : 'sets'} won't be saved.`,
        actions: [{ label: 'Finish workout', icon: 'check', onPress: finish }],
      });
    } else {
      finish();
    }
  };

  const discard = () => {
    setLeaving(true);
    restTimer.stop();
    deleteWorkout(workoutId);
    router.replace('/workout');
  };

  const onDiscard = () =>
    setSheet({
      title: 'Discard workout?',
      message: 'Everything logged in this workout will be deleted.',
      actions: [{ label: 'Discard workout', icon: 'trash-can-outline', destructive: true, onPress: discard }],
    });

  const exerciseMenu = (x: WorkoutExercise, i: number) =>
    setSheet({
      title: x.name,
      actions: [
        ...(i > 0 ? [{ label: 'Move up', icon: 'arrow-up' as const, onPress: () => moveWorkoutExercise(x.id, -1) }] : []),
        ...(i < exercises.length - 1
          ? [{ label: 'Move down', icon: 'arrow-down' as const, onPress: () => moveWorkoutExercise(x.id, 1) }]
          : []),
        { label: 'Remove exercise', icon: 'trash-can-outline', destructive: true, onPress: () => removeWorkoutExercise(x.id) },
      ],
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <View
        style={[styles.header, { paddingTop: insets.top + space.sm, backgroundColor: c.bg, borderBottomColor: c.border }]}>
        <WorkoutHeader
          startedAt={Date.parse(active.started_at)}
          exercises={exercises.length}
          sets={doneSets}
          deltaVsLast={prevVolume > 0 ? volume / prevVolume - 1 : null}
          onMinimize={close}
          onFinish={onFinish}
        />
      </View>

      <EnsureVisibleContext.Provider value={ensureVisible}>
        <ScrollView
          ref={scrollRef}
          onLayout={(e) => (viewportH.current = e.nativeEvent.layout.height)}
          onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          contentContainerStyle={[styles.content, { paddingBottom: (rest ? 140 : space.xxxl) + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View ref={contentRef} style={styles.stack}>
            <Text variant="title" numberOfLines={2}>
              {active.title}
            </Text>

            {exercises.length === 0 ? (
              <Text variant="body" tone="textSecondary">
                Add your first exercise to get going.
              </Text>
            ) : null}

            {exercises.map((x, i) => (
              <ExerciseCard
                key={x.id}
                exercise={x}
                onChangeSet={(setId, patch) =>
                  updateSet(setId, {
                    ...(patch.weightKg !== undefined ? { weight_kg: patch.weightKg } : {}),
                    ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
                  })
                }
                onToggleSet={(setId, fromPanel) => toggleSet(x, setId, fromPanel)}
                onChangeRest={(s) => setRestSeconds(x.id, s)}
                expandedSetId={expandedId}
                onExpandSet={setChosenId}
                onCollapseSet={() => setChosenId(COLLAPSED)}
                onPressSetType={cycleSetType}
                onAddSet={() => addSet(x.id)}
                onDeleteSet={(setId) => {
                  removeSet(setId);
                  setChosenId(COLLAPSED);
                }}
                onPressMenu={() => exerciseMenu(x, i)}
              />
            ))}

            <Button
              label="Add exercise"
              icon="plus"
              variant={exercises.length === 0 ? 'primary' : 'secondary'}
              onPress={() => router.push({ pathname: '/exercises/pick', params: { for: 'workout', id: workoutId } })}
            />
            <Button label="Discard workout" variant="destructive" onPress={onDiscard} />
          </View>
        </ScrollView>
      </EnsureVisibleContext.Provider>

      {rest ? (
        <View style={[styles.restDock, { bottom: space.md + insets.bottom }]}>
          <RestTimerBar
            endsAt={rest.endsAt}
            totalSeconds={rest.total}
            onAdjust={restTimer.adjust}
            onSkip={restTimer.stop}
            onDone={restTimer.stop}
          />
        </View>
      ) : null}

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        message={sheet?.message}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  content: { padding: space.lg },
  stack: { gap: space.lg },
  restDock: { position: 'absolute', left: space.lg, right: space.lg },
});
