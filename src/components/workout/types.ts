export type SetType = 'warmup' | 'normal' | 'failure' | 'drop';

export type WorkoutSet = {
  id: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
  /** Same set position from the last session of this exercise. */
  previous?: { weightKg: number; reps: number };
  /** Suggested values when there's no previous: the set above it in this workout. */
  hint?: { weightKg: number; reps: number };
};

export type WorkoutExercise = {
  id: string;
  name: string;
  equipment: string;
  restSeconds: number;
  sets: WorkoutSet[];
};

/** Normal sets are numbered 1, 2, 3…; other types show their letter. */
export function setLabels(sets: WorkoutSet[]): string[] {
  let n = 0;
  return sets.map((s) =>
    s.type === 'warmup' ? 'W' : s.type === 'failure' ? 'F' : s.type === 'drop' ? 'D' : String(++n),
  );
}
