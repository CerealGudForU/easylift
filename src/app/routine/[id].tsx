// Create or edit a routine: a named list of exercises, each with its sets and rest.
// Changes are kept in a draft until Save.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type SheetAction } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { RestChip } from '@/components/workout/rest-chip';
import { setLabels } from '@/components/workout/types';
import { deleteRoutine, draftExercise, saveRoutine, type RoutineDraft } from '@/lib/data/actions';
import { byPosition } from '@/lib/data/order';
import { getTable, liveRows, useTable, uuid } from '@/lib/data/store';
import type { SetType } from '@/lib/data/types';
import { equipmentLabel, muscleLabel } from '@/lib/exercise-labels';
import { haptic } from '@/lib/haptics';
import { pickResult } from '@/lib/pick-result';
import { radius, size, space, useColors } from '@/theme';

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'failure', 'drop'];

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
          .map((s) => ({ id: s.id, type: s.set_type })),
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

type Sheet = { title?: string; message?: string; actions: SheetAction[] } | null;

export default function RoutineEditorScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new' || !getTable('routines').get(id);
  const [draft, setDraft] = useState<RoutineDraft>(() => loadDraft(id));
  const [sheet, setSheet] = useState<Sheet>(null);
  const exercises = useTable('exercises');

  // Coming back from the exercise picker: append what was picked.
  useFocusEffect(
    useCallback(() => {
      const picked = pickResult.take();
      if (picked?.length) setDraft((d) => ({ ...d, exercises: [...d.exercises, ...picked.map(draftExercise)] }));
    }, []),
  );

  const patchEx = (exId: string, fn: (x: RoutineDraft['exercises'][number]) => RoutineDraft['exercises'][number]) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === exId ? fn(x) : x)) }));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const list = [...d.exercises];
      [list[i], list[i + dir]] = [list[i + dir], list[i]];
      return { ...d, exercises: list };
    });

  // The name is optional: left blank, the routine is named after its main muscles.
  const autoName = autoRoutineName(draft, exercises);
  const canSave = draft.exercises.length > 0;
  const save = () => {
    if (!canSave) return;
    saveRoutine({ ...draft, name: draft.name.trim() || autoName });
    haptic.success();
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
          <Icon name="close" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="title" style={styles.flex}>
          {isNew ? 'New routine' : 'Edit routine'}
        </Text>
        <Button label="Save" variant="primary" compact disabled={!canSave} onPress={save} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled">
        <TextField
          label="Routine name (optional)"
          value={draft.name}
          onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
          placeholder={autoName}
          autoCapitalize="sentences"
          maxLength={80}
        />

        {draft.exercises.map((x, i) => {
          const ex = exercises.get(x.exerciseId);
          const labels = setLabels(x.sets.map((s) => ({ id: s.id, type: s.type, weightKg: null, reps: null, done: false })));
          return (
            <View key={x.id} style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.cardHead}>
                <Text variant="exercise" tone="accent" style={styles.flex} numberOfLines={2}>
                  {ex?.name ?? 'Exercise'}
                </Text>
                <Pressable
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Exercise options"
                  onPress={() =>
                    setSheet({
                      title: ex?.name,
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
                    })
                  }>
                  <Icon name="dots-vertical" size={22} color={c.textSecondary} />
                </Pressable>
              </View>
              <View style={styles.chips}>
                <RestChip seconds={x.restSeconds} onChange={(restSeconds) => patchEx(x.id, (it) => ({ ...it, restSeconds }))} />
                <Chip label={equipmentLabel(ex?.equipment ?? null)} muted />
              </View>
              <View style={styles.sets}>
                {x.sets.map((s, j) => (
                  <View key={s.id} style={[styles.setRow, { backgroundColor: c.field }]}>
                    <Pressable
                      onPress={() =>
                        patchEx(x.id, (it) => ({
                          ...it,
                          sets: it.sets.map((ss) =>
                            ss.id === s.id
                              ? { ...ss, type: SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(ss.type) + 1) % SET_TYPE_CYCLE.length] }
                              : ss,
                          ),
                        }))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${labels[j]}, change set type`}
                      style={styles.setLabel}>
                      <Text
                        variant="numeric"
                        style={{
                          fontSize: 18,
                          color:
                            s.type === 'warmup' ? c.setWarmup : s.type === 'failure' ? c.danger : s.type === 'drop' ? c.setDrop : c.text,
                        }}>
                        {labels[j]}
                      </Text>
                    </Pressable>
                    <Text variant="label" tone="textSecondary" style={styles.flex}>
                      {{ normal: 'Working set', warmup: 'Warm-up', failure: 'To failure', drop: 'Drop set' }[s.type]}
                    </Text>
                    <Pressable
                      onPress={() => patchEx(x.id, (it) => ({ ...it, sets: it.sets.filter((ss) => ss.id !== s.id) }))}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove set ${labels[j]}`}
                      style={styles.setLabel}>
                      <Icon name="close" size={20} color={c.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
              <Button
                label="Add set"
                icon="plus"
                onPress={() => patchEx(x.id, (it) => ({ ...it, sets: [...it.sets, { id: uuid(), type: 'normal' }] }))}
              />
            </View>
          );
        })}

        <Button
          label="Add exercise"
          icon="plus"
          variant={draft.exercises.length === 0 ? 'primary' : 'secondary'}
          onPress={() => router.push({ pathname: '/exercises/pick', params: { for: 'routine' } })}
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
                      router.back();
                    },
                  },
                ],
              })
            }
          />
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        message={sheet?.message}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: size.touch },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  sets: { gap: space.xs },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.control, minHeight: size.touch },
  setLabel: { width: 44, height: size.touch, alignItems: 'center', justifyContent: 'center' },
});
