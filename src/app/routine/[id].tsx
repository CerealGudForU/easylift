// Create or edit a routine. It looks and works like the workout screen (same exercise
// cards, open-a-set steppers, rest chip, set types, exercise menu) minus the
// checkboxes: here you plan each set's kg and reps. Changes are a draft until Save.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { EnsureVisibleContext, type ViewRef } from '@/components/workout/ensure-visible';
import { ExerciseCard } from '@/components/workout/exercise-card';
import type { WorkoutExercise } from '@/components/workout/types';
import { deleteRoutine, draftExercise, saveRoutine, type RoutineDraft } from '@/lib/data/actions';
import { byPosition } from '@/lib/data/order';
import { dependsOn, lastPerformance, useWorkoutData } from '@/lib/data/queries';
import { getTable, liveRows, uuid } from '@/lib/data/store';
import type { SetType } from '@/lib/data/types';
import { equipmentLabel, muscleLabel } from '@/lib/exercise-labels';
import { haptic } from '@/lib/haptics';
import { goBack } from '@/lib/nav';
import { pickResult } from '@/lib/pick-result';
import { size, space, useColors } from '@/theme';

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'failure', 'drop'];

type DraftExercise = RoutineDraft['exercises'][number];

function loadDraft(id: string): RoutineDraft {
  const r = getTable('routines').get(id);
  if (!r || r.deleted_at) return { id: uuid(), name: '', exercises: [] };
  const sets = liveRows(getTable('routine_sets'));
  return {
    id: r.id,
    name: r.name,
    exercises: liveRows(getTable('routine_exercises'))
      .filter((x) => x.routine_id === r.id)
      .sort(byPosition)
      .map((x) => ({
        id: x.id,
        exerciseId: x.exercise_id,
        restSeconds: x.rest_seconds ?? 90,
        sets: sets
          .filter((s) => s.routine_exercise_id === x.id)
          .sort(byPosition)
          .map((s) => ({ id: s.id, type: s.set_type, weightKg: s.target_weight_kg, reps: s.target_reps })),
      })),
  };
}

/** "Chest & Shoulders" from the two muscles the routine works most; "Routine" when empty. */
function autoRoutineName(draft: RoutineDraft, exercises: ReadonlyMap<string, { primary_muscle: string | null }>): string {
  const counts = new Map<string, number>();
  for (const x of draft.exercises) {
    const m = exercises.get(x.exerciseId)?.primary_muscle;
    if (m) counts.set(m, (counts.get(m) ?? 0) + x.sets.length + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m]) => muscleLabel(m));
  return top.length ? top.join(' & ') : 'Routine';
}

type Values = { weightKg: number; reps: number };

/**
 * For each set, what a blank set inherits: the values of the set above it (its own, or
 * what it inherited). Warm-ups only pass values to other warm-ups. Same rule as the
 * workout screen, so a routine of "60 x 10" then two blank sets means 3 x 60 x 10.
 */
function carried(sets: DraftExercise['sets']): (Values | undefined)[] {
  const carry: Partial<Record<'warmup' | 'work', Values>> = {};
  return sets.map((s) => {
    const kind = s.type === 'warmup' ? 'warmup' : 'work';
    const hint = carry[kind];
    if (s.reps != null) carry[kind] = { weightKg: s.weightKg ?? 0, reps: s.reps };
    return hint;
  });
}

type Sheet = { title?: string; message?: string; actions: SheetAction[] } | null;

export default function RoutineEditorScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new' || !getTable('routines').get(id);
  const [draft, setDraft] = useState<RoutineDraft>(() => loadDraft(id));
  const [sheet, setSheet] = useState<Sheet>(null);
  // One set open at a time, like the workout screen; none until you tap one.
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const data = useWorkoutData();

  // Coming back from the exercise picker: append what was picked.
  useFocusEffect(
    useCallback(() => {
      const picked = pickResult.take();
      if (picked?.length) setDraft((d) => ({ ...d, exercises: [...d.exercises, ...picked.map(draftExercise)] }));
    }, []),
  );

  const patchEx = (exId: string, fn: (x: DraftExercise) => DraftExercise) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === exId ? fn(x) : x)) }));
  const patchSet = (exId: string, setId: string, fn: (s: DraftExercise['sets'][number]) => DraftExercise['sets'][number]) =>
    patchEx(exId, (x) => ({ ...x, sets: x.sets.map((s) => (s.id === setId ? fn(s) : s)) }));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const list = [...d.exercises];
      [list[i], list[i + dir]] = [list[i + dir], list[i]];
      return { ...d, exercises: list };
    });

  // The same shape the workout cards draw, with last session's numbers in PREVIOUS.
  const cards: WorkoutExercise[] = useMemo(() => {
    dependsOn(data); // recompute when workout data changes
    return draft.exercises.map((x) => {
      const ex = data.e.get(x.exerciseId);
      const last = lastPerformance(x.exerciseId);
      return {
        id: x.id,
        name: ex?.name ?? 'Exercise',
        equipment: equipmentLabel(ex?.equipment ?? null),
        restSeconds: x.restSeconds,
        sets: x.sets.map((s, i, all) => {
          const p = last?.sets[i];
          return {
            hint: carried(all)[i],
            id: s.id,
            type: s.type,
            weightKg: s.weightKg,
            reps: s.reps,
            done: false,
            previous: p && p.reps != null ? { weightKg: p.weight_kg ?? 0, reps: p.reps } : undefined,
          };
        }),
      };
    });
  }, [draft.exercises, data]);

  // The name is optional: left blank, the routine is named after its main muscles.
  const autoName = autoRoutineName(draft, data.e);
  const canSave = draft.exercises.length > 0;
  const save = () => {
    if (!canSave) return;
    // Blank sets are saved with the values they show (inherited from the set above).
    const filled = draft.exercises.map((x) => {
      const hints = carried(x.sets);
      return {
        ...x,
        sets: x.sets.map((s, i) =>
          s.reps == null && hints[i] ? { ...s, weightKg: s.weightKg ?? hints[i]!.weightKg, reps: hints[i]!.reps } : s,
        ),
      };
    });
    saveRoutine({ ...draft, exercises: filled, name: draft.name.trim() || autoName });
    haptic.success();
    goBack();
  };

  // Keep the open set fully on screen (same as the workout screen).
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
      const visibleBottom = scrollY.current + viewportH.current - space.lg;
      if (top + h > visibleBottom) {
        scrollRef.current?.scrollTo({ y: top + h - viewportH.current + space.xl, animated: true });
      } else if (top < scrollY.current) {
        scrollRef.current?.scrollTo({ y: Math.max(0, top - space.md), animated: true });
      }
    });
  }, []);

  const exerciseMenu = (x: WorkoutExercise, i: number) =>
    setSheet({
      title: x.name,
      actions: [
        ...(i > 0 ? [{ label: 'Move up', icon: 'arrow-up' as const, onPress: () => move(i, -1) }] : []),
        ...(i < draft.exercises.length - 1
          ? [{ label: 'Move down', icon: 'arrow-down' as const, onPress: () => move(i, 1) }]
          : []),
        {
          label: 'Remove exercise',
          icon: 'trash-can-outline',
          destructive: true,
          onPress: () => setDraft((d) => ({ ...d, exercises: d.exercises.filter((it) => it.id !== x.id) })),
        },
      ],
    });

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={[styles.top, { borderBottomColor: c.border }]}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Icon name="close" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="title" style={styles.flex}>
          {isNew ? 'New routine' : 'Edit routine'}
        </Text>
        <Button label="Save" variant="primary" compact disabled={!canSave} onPress={save} />
      </View>

      <EnsureVisibleContext.Provider value={ensureVisible}>
        <ScrollView
          ref={scrollRef}
          onLayout={(e) => (viewportH.current = e.nativeEvent.layout.height)}
          onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View ref={contentRef} style={styles.stack}>
            <TextField
              label="Routine name (optional)"
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder={autoName}
              autoCapitalize="sentences"
              maxLength={80}
            />

            {cards.map((x, i) => (
              <ExerciseCard
                key={x.id}
                exercise={x}
                expandedSetId={openSetId}
                onExpandSet={setOpenSetId}
                onCollapseSet={() => setOpenSetId(null)}
                onChangeSet={(setId, patch) =>
                  patchSet(x.id, setId, (s) => ({
                    ...s,
                    ...(patch.weightKg !== undefined ? { weightKg: patch.weightKg } : {}),
                    ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
                  }))
                }
                onPressSetType={(setId) =>
                  patchSet(x.id, setId, (s) => ({
                    ...s,
                    type: SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(s.type) + 1) % SET_TYPE_CYCLE.length],
                  }))
                }
                onChangeRest={(restSeconds) => patchEx(x.id, (it) => ({ ...it, restSeconds }))}
                // A new set copies the one above and opens, ready to adjust.
                onAddSet={() => {
                  const newId = uuid();
                  patchEx(x.id, (it) => {
                    const last = it.sets[it.sets.length - 1];
                    return {
                      ...it,
                      sets: [...it.sets, { id: newId, type: 'normal', weightKg: last?.weightKg ?? null, reps: last?.reps ?? null }],
                    };
                  });
                  setOpenSetId(newId);
                }}
                onDeleteSet={(setId) => {
                  patchEx(x.id, (it) => ({ ...it, sets: it.sets.filter((s) => s.id !== setId) }));
                  setOpenSetId(null);
                }}
                onPressMenu={() => exerciseMenu(x, i)}
              />
            ))}

            <Button
              label="Add exercise"
              icon="plus"
              variant={draft.exercises.length === 0 ? 'primary' : 'secondary'}
              onPress={() =>
                router.push({
                  pathname: '/exercises/pick',
                  params: { for: 'routine', current: draft.exercises.map((x) => x.exerciseId).join(',') },
                })
              }
            />
            {!isNew ? (
              <Button
                label="Delete routine"
                variant="destructive"
                onPress={() =>
                  setSheet({
                    title: 'Delete routine?',
                    message: 'Your past workouts stay in your history.',
                    actions: [
                      {
                        label: 'Delete routine',
                        icon: 'trash-can-outline',
                        destructive: true,
                        onPress: () => {
                          deleteRoutine(draft.id);
                          goBack();
                        },
                      },
                    ],
                  })
                }
              />
            ) : null}
          </View>
        </ScrollView>
      </EnsureVisibleContext.Provider>

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
  screen: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    minHeight: size.touch,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  content: { padding: space.lg },
  stack: { gap: space.lg },
});
