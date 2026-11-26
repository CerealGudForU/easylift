// Seed the global exercise library from scripts/exercise-library.mts.
// Safe to re-run: rows upsert on source_id (a slug of the name). Global exercises
// that are no longer in the list get a deleted_at tombstone, so devices drop them
// on their next sync; anything already logged against them keeps working.
// Usage: npm run seed:exercises
import { admin } from './admin-client.mts';
import { LIBRARY } from './exercise-library.mts';

const slug = (name: string) =>
  'el_' + name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const now = new Date().toISOString();
const rows = LIBRARY.map(([name, equipment, primary, secondary = [], kind = 'weight_reps']) => ({
  source_id: slug(name),
  name,
  kind,
  category: primary === 'cardio' ? 'cardio' : 'strength',
  primary_muscle: primary,
  secondary_muscles: secondary,
  equipment,
  force: null,
  level: null,
  mechanic: null,
  instructions: [],
  images: [],
  owner_id: null,
  client_updated_at: now,
  deleted_at: null,
}));

const ids = new Set(rows.map((r) => r.source_id));
if (ids.size !== rows.length) throw new Error('Duplicate exercise names in the library');

const { error } = await admin.from('exercises').upsert(rows, { onConflict: 'source_id' });
if (error) throw new Error(`Upsert failed: ${error.message}`);

// Retire global exercises that are no longer in the list.
const { data: existing, error: listError } = await admin
  .from('exercises')
  .select('id, source_id')
  .is('owner_id', null)
  .is('deleted_at', null);
if (listError) throw new Error(`Listing failed: ${listError.message}`);
const retire = (existing ?? []).filter((x) => !x.source_id || !ids.has(x.source_id)).map((x) => x.id);
for (let i = 0; i < retire.length; i += 200) {
  const { error: e } = await admin
    .from('exercises')
    .update({ deleted_at: now, client_updated_at: now })
    .in('id', retire.slice(i, i + 200));
  if (e) throw new Error(`Retiring failed: ${e.message}`);
}
console.log(`Library: ${rows.length} exercises. Retired ${retire.length} old ones.`);
