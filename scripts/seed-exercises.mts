// Seed the global exercise library from yuhonas/free-exercise-db (Unlicense,
// public domain). Safe to re-run: rows upsert on source_id.
// Usage: npm run seed:exercises
import { admin } from './admin-client.mts';

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

type Source = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function kindOf(x: Source) {
  if (x.category === 'cardio') return 'distance_time';
  if (x.equipment === 'body only') return 'reps';
  return 'weight_reps';
}

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const data: unknown = await res.json();
if (!Array.isArray(data)) throw new Error('Unexpected format: expected an array');

// Stretches are left out: EasyLift logs training sets.
const rows = (data as Source[])
  .filter((x) => str(x?.id) && str(x?.name) && x.category !== 'stretching')
  .map((x) => ({
    source_id: str(x.id)!,
    name: str(x.name)!.slice(0, 80),
    kind: kindOf(x),
    category: str(x.category),
    primary_muscle: strs(x.primaryMuscles)[0] ?? null,
    secondary_muscles: [...strs(x.primaryMuscles).slice(1), ...strs(x.secondaryMuscles)],
    equipment: str(x.equipment),
    force: str(x.force),
    level: str(x.level),
    mechanic: str(x.mechanic),
    instructions: strs(x.instructions),
    images: strs(x.images),
    owner_id: null,
  }));

for (let i = 0; i < rows.length; i += 200) {
  const { error } = await admin.from('exercises').upsert(rows.slice(i, i + 200), { onConflict: 'source_id' });
  if (error) throw new Error(`Upsert failed at ${i}: ${error.message}`);
}
console.log(`Seeded ${rows.length} exercises (of ${data.length} in the source).`);
