// Read helpers over the device store. Indexes are cached per table version, so
// repeated lookups during a render are cheap and they rebuild only after a change.
import { useMemo } from 'react';

import { byPosition } from './order';
import { getTable, liveRows, useTable } from './store';
import type { ExerciseRow, Local, WorkoutExerciseRow, WorkoutRow, WorkoutSetRow } from './types';

function indexed<T extends { id: string }, K>(
  cache: WeakMap<object, Map<K, T[]>>,
  table: ReadonlyMap<string, T & { deleted_at: string | null }>,
  key: (row: T) => K,
  sort?: (a: T, b: T) => number,
): Map<K, T[]> {
  let idx = cache.get(table);
  if (!idx) {
    idx = new Map();
    for (const r of table.values()) {
      if (r.deleted_at) continue;
      const k = key(r);
      let list = idx.get(k);
      if (!list) idx.set(k, (list = []));
      list.push(r);
    }
    if (sort) for (const list of idx.values()) list.sort(sort);
    cache.set(table, idx);
  }
  return idx;
}

const setsCache = new WeakMap<object, Map<string, Local<WorkoutSetRow>[]>>();
const exCache = new WeakMap<object, Map<string, Local<WorkoutExerciseRow>[]>>();
const byExerciseCache = new WeakMap<object, Map<string, Local<WorkoutExerciseRow>[]>>();

export function setsOf(workoutExerciseId: string): Local<WorkoutSetRow>[] {
  return indexed(setsCache, getTable('workout_sets'), (s) => s.workout_exercise_id, byPosition).get(workoutExerciseId) ?? [];
}

export function exercisesOf(workoutId: string): Local<WorkoutExerciseRow>[] {
  return indexed(exCache, getTable('workout_exercises'), (x) => x.workout_id, byPosition).get(workoutId) ?? [];
}

/** The workout in progress, if any (the newest one without an end time). */
export function activeWorkoutId(): string | null {
  let best: WorkoutRow | null = null;
  for (const w of liveRows(getTable('workouts'))) {
    if (!w.ended_at && (!best || w.started_at > best.started_at)) best = w;
  }
  return best?.id ?? null;
}

export function useActiveWorkout(): Local<WorkoutRow> | null {
  const workouts = useTable('workouts');
  return useMemo(() => {
    const id = activeWorkoutId();
    return id ? (workouts.get(id) ?? null) : null;
  }, [workouts]);
}

export type LastPerformance = {
  workoutId: string;
  endedAt: string;
  restSeconds: number | null;
  sets: Local<WorkoutSetRow>[];
};

/** The most recent finished workout that included this exercise, and its sets. */
export function lastPerformance(exerciseId: string, excludeWorkoutId?: string): LastPerformance | null {
  const workouts = getTable('workouts');
  const uses = indexed(byExerciseCache, getTable('workout_exercises'), (x) => x.exercise_id).get(exerciseId) ?? [];
  let best: LastPerformance | null = null;
  for (const we of uses) {
    if (we.workout_id === excludeWorkoutId) continue;
    const w = workouts.get(we.workout_id);
    if (!w || w.deleted_at || !w.ended_at) continue;
    if (best && w.ended_at <= best.endedAt) continue;
    const sets = setsOf(we.id).filter((s) => s.completed_at);
    if (sets.length) best = { workoutId: w.id, endedAt: w.ended_at, restSeconds: we.rest_seconds, sets };
  }
  return best;
}

/** Re-renders when any workout data changes. Use around lastPerformance/setsOf. */
export function useWorkoutData() {
  const w = useTable('workouts');
  const x = useTable('workout_exercises');
  const s = useTable('workout_sets');
  const e = useTable('exercises');
  return useMemo(() => ({ w, x, s, e }), [w, x, s, e]);
}

// --- Stats -----------------------------------------------------------------------

export type WorkoutStats = { durationS: number; volumeKg: number; sets: number; exercises: number };

export function workoutStats(workoutId: string): WorkoutStats {
  const w = getTable('workouts').get(workoutId);
  let volumeKg = 0;
  let sets = 0;
  let exercises = 0;
  for (const we of exercisesOf(workoutId)) {
    const done = setsOf(we.id).filter((s) => s.completed_at);
    if (done.length) exercises++;
    for (const s of done) {
      sets++;
      if (s.set_type !== 'warmup') volumeKg += (s.weight_kg ?? 0) * (s.reps ?? 0);
    }
  }
  const end = w?.ended_at ? Date.parse(w.ended_at) : Date.now();
  const durationS = w ? Math.max(0, Math.round((end - Date.parse(w.started_at)) / 1000)) : 0;
  return { durationS, volumeKg, sets, exercises };
}

/** Epley estimated one-rep max. */
export const e1rm = (weightKg: number, reps: number) => (reps <= 0 ? 0 : reps === 1 ? weightKg : weightKg * (1 + reps / 30));

export type Best = { exerciseId: string; name: string; kind: 'e1rm' | 'weight'; value: number };

/**
 * New bests in this workout compared with every earlier finished workout:
 * heaviest weight and best estimated 1RM, per exercise. (Phase 5 stores these.)
 */
export function newBests(workoutId: string): Best[] {
  const w = getTable('workouts').get(workoutId);
  if (!w) return [];
  const workouts = getTable('workouts');
  const exercises = getTable('exercises');
  const out: Best[] = [];
  for (const we of exercisesOf(workoutId)) {
    const mine = setsOf(we.id).filter((s) => s.completed_at && s.set_type !== 'warmup' && s.weight_kg && s.reps);
    if (!mine.length) continue;
    const top = (sets: WorkoutSetRow[]) => ({
      weight: Math.max(0, ...sets.map((s) => s.weight_kg ?? 0)),
      e1rm: Math.max(0, ...sets.map((s) => e1rm(s.weight_kg ?? 0, s.reps ?? 0))),
    });
    const now = top(mine);
    const earlier: WorkoutSetRow[] = [];
    const uses = indexed(byExerciseCache, getTable('workout_exercises'), (x) => x.exercise_id).get(we.exercise_id) ?? [];
    for (const other of uses) {
      const ow = workouts.get(other.workout_id);
      if (!ow || ow.deleted_at || !ow.ended_at || ow.id === workoutId || ow.started_at >= w.started_at) continue;
      earlier.push(...setsOf(other.id).filter((s) => s.completed_at && s.set_type !== 'warmup'));
    }
    if (!earlier.length) continue; // first time: nothing to beat
    const before = top(earlier);
    const name = exercises.get(we.exercise_id)?.name ?? 'Exercise';
    if (now.weight > before.weight) out.push({ exerciseId: we.exercise_id, name, kind: 'weight', value: now.weight });
    else if (now.e1rm > before.e1rm + 0.01)
      out.push({ exerciseId: we.exercise_id, name, kind: 'e1rm', value: Math.round(now.e1rm * 10) / 10 });
  }
  return out;
}

/** Finished workouts, newest first. */
export function useHistory(): Local<WorkoutRow>[] {
  const workouts = useTable('workouts');
  return useMemo(
    () =>
      liveRows(workouts)
        .filter((w) => w.ended_at)
        .sort((a, b) => (a.started_at < b.started_at ? 1 : -1)),
    [workouts],
  );
}

export function useExercises(): Local<ExerciseRow>[] {
  const t = useTable('exercises');
  return useMemo(() => [...liveRows(t)].sort((a, b) => a.name.localeCompare(b.name)), [t]);
}
