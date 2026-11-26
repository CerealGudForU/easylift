// Everything the UI can change. All writes go to the device store; sync pushes them.
import { currentUserId, getTable, liveRows, uuid, write } from './store';
import type { ExerciseKind, SetType, WorkoutSetRow } from './types';
import { byPosition } from './order';
import { activeWorkoutId, exercisesOf, lastPerformance, setsOf } from './queries';

const DEFAULT_REST = 90;
const DEFAULT_SETS = 3;
const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'failure', 'drop'];

// --- Workouts --------------------------------------------------------------------

/** Starts an empty workout, or one copied from a routine. Returns its id. */
export function startWorkout(routineId?: string): string {
  const existing = activeWorkoutId();
  if (existing) return existing;
  const owner_id = currentUserId();
  const id = uuid();
  const routine = routineId ? getTable('routines').get(routineId) : undefined;
  write((tx) => {
    tx.put('workouts', {
      id,
      owner_id,
      routine_id: routine?.id ?? null,
      title: routine?.name ?? defaultTitle(new Date()),
      started_at: new Date().toISOString(),
      ended_at: null,
      notes: null,
      visibility: 'friends',
    });
    if (!routine) return;
    const rex = liveRows(getTable('routine_exercises'))
      .filter((r) => r.routine_id === routine.id)
      .sort(byPosition);
    const rsets = liveRows(getTable('routine_sets'));
    rex.forEach((re, i) => {
      const weId = uuid();
      tx.put('workout_exercises', {
        id: weId,
        owner_id,
        workout_id: id,
        exercise_id: re.exercise_id,
        position: i,
        superset_group: re.superset_group,
        rest_seconds: re.rest_seconds ?? DEFAULT_REST,
        notes: re.notes,
      });
      rsets
        .filter((s) => s.routine_exercise_id === re.id)
        .sort(byPosition)
        .forEach((s, j) => tx.put('workout_sets', emptySet(owner_id, id, weId, j, s.set_type)));
    });
  });
  return id;
}

export function defaultTitle(d: Date): string {
  const h = d.getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 22 ? 'Evening' : 'Night';
  return `${part} workout`;
}

function emptySet(owner_id: string, workout_id: string, workout_exercise_id: string, position: number, set_type: SetType = 'normal') {
  return {
    id: uuid(),
    owner_id,
    workout_id,
    workout_exercise_id,
    position,
    set_type,
    weight_kg: null,
    reps: null,
    rpe: null,
    duration_s: null,
    distance_m: null,
    completed_at: null,
  } satisfies Omit<WorkoutSetRow, 'client_updated_at' | 'deleted_at'>;
}

/** Adds exercises to the end of a workout, with as many sets as last time (or 3). */
export function addExercisesToWorkout(workoutId: string, exerciseIds: string[]) {
  const owner_id = currentUserId();
  const existing = exercisesOf(workoutId);
  let pos = existing.length ? Math.max(...existing.map((x) => x.position)) + 1 : 0;
  write((tx) => {
    for (const exId of exerciseIds) {
      const weId = uuid();
      const last = lastPerformance(exId, workoutId);
      tx.put('workout_exercises', {
        id: weId,
        owner_id,
        workout_id: workoutId,
        exercise_id: exId,
        position: pos++,
        superset_group: null,
        rest_seconds: last?.restSeconds ?? DEFAULT_REST,
        notes: null,
      });
      const types = last?.sets.map((s) => s.set_type) ?? Array<SetType>(DEFAULT_SETS).fill('normal');
      types.forEach((t, j) => tx.put('workout_sets', emptySet(owner_id, workoutId, weId, j, t)));
    }
  });
}

export function addSet(workoutExerciseId: string) {
  const we = getTable('workout_exercises').get(workoutExerciseId);
  if (!we) return;
  const sets = setsOf(workoutExerciseId);
  const pos = sets.length ? sets[sets.length - 1].position + 1 : 0;
  write((tx) => tx.put('workout_sets', emptySet(we.owner_id, we.workout_id, we.id, pos)));
}

export function removeSet(setId: string) {
  write((tx) => tx.remove('workout_sets', setId));
}

export function updateSet(setId: string, patch: Partial<Pick<WorkoutSetRow, 'weight_kg' | 'reps' | 'set_type'>>) {
  write((tx) => tx.patch('workout_sets', setId, patch));
}

export function cycleSetType(setId: string) {
  const s = getTable('workout_sets').get(setId);
  if (!s) return;
  const next = SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(s.set_type) + 1) % SET_TYPE_CYCLE.length];
  write((tx) => tx.patch('workout_sets', setId, { set_type: next }));
}

/** Marks a set done (filling in any blank values) or not done. */
export function setDone(setId: string, done: boolean, fill?: { weightKg: number | null; reps: number | null }) {
  const s = getTable('workout_sets').get(setId);
  if (!s) return;
  write((tx) =>
    tx.patch('workout_sets', setId, {
      completed_at: done ? new Date().toISOString() : null,
      weight_kg: done ? (s.weight_kg ?? fill?.weightKg ?? null) : s.weight_kg,
      reps: done ? (s.reps ?? fill?.reps ?? null) : s.reps,
    }),
  );
}

export function setRestSeconds(workoutExerciseId: string, seconds: number) {
  write((tx) => tx.patch('workout_exercises', workoutExerciseId, { rest_seconds: seconds }));
}

export function removeWorkoutExercise(workoutExerciseId: string) {
  write((tx) => {
    for (const s of setsOf(workoutExerciseId)) tx.remove('workout_sets', s.id);
    tx.remove('workout_exercises', workoutExerciseId);
  });
}

/** Moves an exercise one place up (-1) or down (+1). */
export function moveWorkoutExercise(workoutExerciseId: string, dir: -1 | 1) {
  const we = getTable('workout_exercises').get(workoutExerciseId);
  if (!we) return;
  const list = exercisesOf(we.workout_id);
  const i = list.findIndex((x) => x.id === workoutExerciseId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const reordered = [...list];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  write((tx) => reordered.forEach((x, k) => x.position !== k && tx.patch('workout_exercises', x.id, { position: k })));
}

export function renameWorkout(workoutId: string, title: string) {
  const t = title.trim().slice(0, 80);
  if (t) write((tx) => tx.patch('workouts', workoutId, { title: t }));
}

/** Ends the workout. Unfinished sets, and exercises left with no sets, are dropped. */
export function finishWorkout(workoutId: string) {
  write((tx) => {
    for (const we of exercisesOf(workoutId)) {
      const sets = setsOf(we.id);
      const done = sets.filter((s) => s.completed_at);
      for (const s of sets) if (!s.completed_at) tx.remove('workout_sets', s.id);
      if (done.length === 0) tx.remove('workout_exercises', we.id);
      else done.forEach((s, k) => s.position !== k && tx.patch('workout_sets', s.id, { position: k }));
    }
    tx.patch('workouts', workoutId, { ended_at: new Date().toISOString() });
  });
}

/** Deletes a workout (in progress or finished) and everything in it. */
export function deleteWorkout(workoutId: string) {
  write((tx) => {
    for (const we of exercisesOf(workoutId)) {
      for (const s of setsOf(we.id)) tx.remove('workout_sets', s.id);
      tx.remove('workout_exercises', we.id);
    }
    tx.remove('workouts', workoutId);
  });
}

// --- Routines --------------------------------------------------------------------

export type RoutineDraft = {
  id: string;
  name: string;
  exercises: {
    id: string;
    exerciseId: string;
    restSeconds: number;
    sets: { id: string; type: SetType }[];
  }[];
};

/** Saves a routine draft: rows that were removed from it are deleted. */
export function saveRoutine(draft: RoutineDraft) {
  const owner_id = currentUserId();
  const existing = getTable('routines').get(draft.id);
  const oldEx = liveRows(getTable('routine_exercises')).filter((r) => r.routine_id === draft.id);
  const oldSets = liveRows(getTable('routine_sets')).filter((s) => oldEx.some((e) => e.id === s.routine_exercise_id));
  const keepEx = new Set(draft.exercises.map((x) => x.id));
  const keepSets = new Set(draft.exercises.flatMap((x) => x.sets.map((s) => s.id)));
  const position = existing?.position ?? liveRows(getTable('routines')).length;

  write((tx) => {
    tx.put('routines', {
      id: draft.id,
      owner_id,
      name: draft.name.trim().slice(0, 80) || 'Routine',
      folder: existing?.folder ?? null,
      position,
      notes: existing?.notes ?? null,
    });
    for (const s of oldSets) if (!keepSets.has(s.id)) tx.remove('routine_sets', s.id);
    for (const e of oldEx) if (!keepEx.has(e.id)) tx.remove('routine_exercises', e.id);
    draft.exercises.forEach((x, i) => {
      tx.put('routine_exercises', {
        id: x.id,
        owner_id,
        routine_id: draft.id,
        exercise_id: x.exerciseId,
        position: i,
        superset_group: null,
        rest_seconds: x.restSeconds,
        notes: null,
      });
      x.sets.forEach((s, j) =>
        tx.put('routine_sets', {
          id: s.id,
          owner_id,
          routine_exercise_id: x.id,
          position: j,
          set_type: s.type,
          target_reps: null,
          target_weight_kg: null,
        }),
      );
    });
  });
}

export function deleteRoutine(routineId: string) {
  const ex = liveRows(getTable('routine_exercises')).filter((r) => r.routine_id === routineId);
  const sets = liveRows(getTable('routine_sets')).filter((s) => ex.some((e) => e.id === s.routine_exercise_id));
  write((tx) => {
    for (const s of sets) tx.remove('routine_sets', s.id);
    for (const e of ex) tx.remove('routine_exercises', e.id);
    tx.remove('routines', routineId);
  });
}

/** A blank draft row for the routine editor. */
export function draftExercise(exerciseId: string): RoutineDraft['exercises'][number] {
  const last = lastPerformance(exerciseId);
  const types = last?.sets.map((s) => s.set_type) ?? Array<SetType>(DEFAULT_SETS).fill('normal');
  return {
    id: uuid(),
    exerciseId,
    restSeconds: last?.restSeconds ?? DEFAULT_REST,
    sets: types.map((type) => ({ id: uuid(), type })),
  };
}

// --- Exercises -------------------------------------------------------------------

export function createExercise(input: { name: string; equipment: string; primaryMuscle: string; kind?: ExerciseKind }) {
  const id = uuid();
  write((tx) =>
    tx.put('exercises', {
      id,
      owner_id: currentUserId(),
      name: input.name.trim().slice(0, 80),
      kind: input.kind ?? 'weight_reps',
      category: 'strength',
      primary_muscle: input.primaryMuscle,
      secondary_muscles: [],
      equipment: input.equipment,
    }),
  );
  return id;
}
