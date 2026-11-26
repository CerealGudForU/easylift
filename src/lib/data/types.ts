// Local copies of the synced Supabase tables (supabase/migrations/*_training.sql).
// Column names match the server so rows go up and down without mapping.
// Timestamps are ISO strings. Weight is always kg.

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop';
export type ExerciseKind = 'weight_reps' | 'reps' | 'weighted_bodyweight' | 'time' | 'distance_time';

type Synced = {
  id: string;
  client_updated_at: string;
  deleted_at: string | null;
};

export type ExerciseRow = Synced & {
  owner_id: string | null;
  name: string;
  kind: ExerciseKind;
  category: string | null;
  primary_muscle: string | null;
  secondary_muscles: string[];
  equipment: string | null;
};

export type RoutineRow = Synced & {
  owner_id: string;
  name: string;
  folder: string | null;
  position: number;
  notes: string | null;
};

export type RoutineExerciseRow = Synced & {
  owner_id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  superset_group: number | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type RoutineSetRow = Synced & {
  owner_id: string;
  routine_exercise_id: string;
  position: number;
  set_type: SetType;
  target_reps: number | null;
  target_weight_kg: number | null;
};

export type WorkoutRow = Synced & {
  owner_id: string;
  routine_id: string | null;
  title: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  visibility: 'friends' | 'private';
};

export type WorkoutExerciseRow = Synced & {
  owner_id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  superset_group: number | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type WorkoutSetRow = Synced & {
  owner_id: string;
  workout_id: string;
  workout_exercise_id: string;
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_s: number | null;
  distance_m: number | null;
  completed_at: string | null;
};

export type Rows = {
  exercises: ExerciseRow;
  routines: RoutineRow;
  routine_exercises: RoutineExerciseRow;
  routine_sets: RoutineSetRow;
  workouts: WorkoutRow;
  workout_exercises: WorkoutExerciseRow;
  workout_sets: WorkoutSetRow;
};

export type TableName = keyof Rows;

/** Parents before children, so pushes never break a foreign key. */
export const TABLES: TableName[] = [
  'exercises',
  'routines',
  'routine_exercises',
  'routine_sets',
  'workouts',
  'workout_exercises',
  'workout_sets',
];

/** Columns pulled from the server (exercises skip the bulky instructions/images). */
export const COLUMNS: Record<TableName, string> = {
  exercises: 'id, owner_id, name, kind, category, primary_muscle, secondary_muscles, equipment, client_updated_at, deleted_at, updated_at',
  routines: 'id, owner_id, name, folder, position, notes, client_updated_at, deleted_at, updated_at',
  routine_exercises:
    'id, owner_id, routine_id, exercise_id, position, superset_group, rest_seconds, notes, client_updated_at, deleted_at, updated_at',
  routine_sets:
    'id, owner_id, routine_exercise_id, position, set_type, target_reps, target_weight_kg, client_updated_at, deleted_at, updated_at',
  workouts:
    'id, owner_id, routine_id, title, started_at, ended_at, notes, visibility, client_updated_at, deleted_at, updated_at',
  workout_exercises:
    'id, owner_id, workout_id, exercise_id, position, superset_group, rest_seconds, notes, client_updated_at, deleted_at, updated_at',
  workout_sets:
    'id, owner_id, workout_id, workout_exercise_id, position, set_type, weight_kg, reps, rpe, duration_s, distance_m, completed_at, client_updated_at, deleted_at, updated_at',
};

/** A row as kept on the device: `_dirty` marks changes not yet pushed. */
export type Local<T> = T & { _dirty?: 1 };
