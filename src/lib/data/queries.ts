// Read helpers over the device store. Indexes are cached per table version, so
// repeated lookups during a render are cheap and they rebuild only after a change.
import { useMemo } from 'react';

import { byPosition } from './order';
import { getTable, liveRows, useTable } from './store';
import { personalRecords, RECORD_KINDS, recordsSetIn, type PersonalRecord, type RecordKind, type Session } from '../progress';
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

/** A finished workout's completed sets for one exercise, as progress maths takes them. */
function sessionsFor(exerciseId: string): Session[] {
  const workouts = getTable('workouts');
  const uses = indexed(byExerciseCache, getTable('workout_exercises'), (x) => x.exercise_id).get(exerciseId) ?? [];
  const byWorkout = new Map<string, Session>();
  for (const we of uses) {
    const w = workouts.get(we.workout_id);
    if (!w || w.deleted_at || !w.ended_at) continue;
    const sets = setsOf(we.id)
      .filter((s) => s.completed_at)
      .map((s) => ({ weightKg: s.weight_kg, reps: s.reps, type: s.set_type }));
    if (!sets.length) continue;
    // The same exercise twice in one workout counts as one session.
    const cur = byWorkout.get(w.id);
    if (cur) cur.sets.push(...sets);
    else byWorkout.set(w.id, { workoutId: w.id, date: w.started_at, sets });
  }
  return [...byWorkout.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Keyed on all three tables a session depends on: rebuilt after any change to them.
let sessionsKey: readonly object[] = [];
let sessionsCache = new Map<string, Session[]>();

/** Every finished session of an exercise, oldest first. Cached until workout data changes. */
export function exerciseSessions(exerciseId: string): Session[] {
  const key = [getTable('workouts'), getTable('workout_exercises'), getTable('workout_sets')];
  if (key.some((t, i) => t !== sessionsKey[i])) {
    sessionsKey = key;
    sessionsCache = new Map();
  }
  let list = sessionsCache.get(exerciseId);
  if (!list) sessionsCache.set(exerciseId, (list = sessionsFor(exerciseId)));
  return list;
}

export type Best = PersonalRecord & { exerciseId: string; name: string };

/** Personal records set in this workout, per exercise, compared with every earlier finished workout. */
export function newBests(workoutId: string): Best[] {
  const exercises = getTable('exercises');
  const out: Best[] = [];
  const seen = new Set<string>();
  for (const we of exercisesOf(workoutId)) {
    if (seen.has(we.exercise_id)) continue;
    seen.add(we.exercise_id);
    const name = exercises.get(we.exercise_id)?.name ?? 'Exercise';
    for (const r of recordsSetIn(exerciseSessions(we.exercise_id), workoutId)) {
      out.push({ ...r, exerciseId: we.exercise_id, name });
    }
  }
  return out;
}

export type PerformedExercise = {
  exercise: Local<ExerciseRow>;
  sessions: number;
  lastDate: string;
  /** All-time best per record kind (0 where there's none). */
  best: Record<RecordKind, number>;
};

/** Exercises you've logged in a finished workout, most recently done first. */
export function usePerformedExercises(): PerformedExercise[] {
  const data = useWorkoutData();
  return useMemo(() => {
    const out: PerformedExercise[] = [];
    const ids = new Set<string>();
    for (const we of liveRows(data.x)) ids.add(we.exercise_id);
    for (const id of ids) {
      const exercise = data.e.get(id);
      if (!exercise) continue;
      const sessions = exerciseSessions(id);
      if (!sessions.length) continue;
      const prs = personalRecords(sessions);
      const best = { weight: 0, e1rm: 0, setVolume: 0, volume: 0, reps: 0 };
      for (const k of RECORD_KINDS) best[k] = prs[k]?.value ?? 0;
      out.push({ exercise, sessions: sessions.length, lastDate: sessions[sessions.length - 1].date, best });
    }
    return out.sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
  }, [data]);
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

/** Per finished workout: when, and its totals (for weekly charts and the calendar). Newest first. */
export function useWorkoutSummaries(): (WorkoutStats & { id: string; title: string; startedAt: string })[] {
  const history = useHistory();
  const data = useWorkoutData();
  return useMemo(() => {
    dependsOn(data); // recompute when workout data changes
    return history.map((w) => ({ id: w.id, title: w.title, startedAt: w.started_at, ...workoutStats(w.id) }));
  }, [history, data]);
}

export function useExercises(): Local<ExerciseRow>[] {
  const t = useTable('exercises');
  return useMemo(() => [...liveRows(t)].sort((a, b) => a.name.localeCompare(b.name)), [t]);
}

/**
 * Marks a memo as depending on store tables that the helpers it calls read through
 * getTable() (setsOf, workoutStats, exerciseSessions…). Use it instead of `void data`:
 * the React Compiler drops a bare `void x` and the memo would then never recompute.
 */
export function dependsOn(..._tables: unknown[]): void {}
