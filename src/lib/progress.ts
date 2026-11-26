// Progress maths: personal records, chart series, weekly totals, streaks and the
// calendar grid. Pure functions over plain data (no store, no React), so they are
// tested against fixtures in progress.test.ts.

/** One logged set, as far as progress cares. Only completed sets are passed in. */
export type ProgressSet = { weightKg: number | null; reps: number | null; type: string };

/** One finished workout's sets for one exercise. */
export type Session = { workoutId: string; date: string; sets: ProgressSet[] };

/** Epley estimated one-rep max. 1 rep is the weight itself; 0 reps is nothing. */
export const e1rm = (weightKg: number, reps: number) =>
  reps <= 0 || weightKg <= 0 ? 0 : reps === 1 ? weightKg : weightKg * (1 + reps / 30);

const round1 = (n: number) => Math.round(n * 10) / 10;

export type SessionMetrics = {
  /** Heaviest weight lifted for at least one rep. */
  weight: number;
  /** Best estimated 1RM of any set. */
  e1rm: number;
  /** Best single set by weight × reps. */
  setVolume: number;
  /** Total weight × reps across the session. */
  volume: number;
  /** Most reps in one set. */
  reps: number;
  /** Working sets (warm-ups excluded). */
  sets: number;
};

/** Warm-ups never count towards records or volume. */
export function sessionMetrics(sets: ProgressSet[]): SessionMetrics {
  const m: SessionMetrics = { weight: 0, e1rm: 0, setVolume: 0, volume: 0, reps: 0, sets: 0 };
  for (const s of sets) {
    if (s.type === 'warmup') continue;
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    if (r <= 0) continue;
    m.sets++;
    m.weight = Math.max(m.weight, w);
    m.e1rm = Math.max(m.e1rm, e1rm(w, r));
    m.setVolume = Math.max(m.setVolume, w * r);
    m.volume += w * r;
    m.reps = Math.max(m.reps, r);
  }
  m.e1rm = round1(m.e1rm);
  return m;
}

export type RecordKind = 'weight' | 'e1rm' | 'setVolume' | 'volume' | 'reps';
export const RECORD_KINDS: RecordKind[] = ['weight', 'e1rm', 'setVolume', 'volume', 'reps'];

export type PersonalRecord = {
  kind: RecordKind;
  value: number;
  workoutId: string;
  date: string;
  /** The set behind it, e.g. { weightKg: 100, reps: 5 }; null for session volume. */
  set: { weightKg: number; reps: number } | null;
};

const byDate = (a: Session, b: Session) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** The set that produced a session's best for a kind (first one wins a tie). */
function bestSet(sets: ProgressSet[], kind: RecordKind): { weightKg: number; reps: number } | null {
  if (kind === 'volume') return null;
  let best: { weightKg: number; reps: number } | null = null;
  let bestScore = 0;
  for (const s of sets) {
    if (s.type === 'warmup' || !s.reps || s.reps <= 0) continue;
    const w = s.weightKg ?? 0;
    // Ties on weight/reps go to the set with more of the other (100 × 5 beats 100 × 3).
    const score =
      kind === 'weight' ? w * 1e4 + s.reps : kind === 'reps' ? s.reps * 1e4 + w : kind === 'e1rm' ? e1rm(w, s.reps) : w * s.reps;
    if (score > bestScore) {
      bestScore = score;
      best = { weightKg: w, reps: s.reps };
    }
  }
  return best;
}

/**
 * All-time bests per kind. The earliest session to reach the best value holds the
 * record (matching it later doesn't take it). Kinds with nothing to show (e.g. weight
 * for a bodyweight exercise) are left out.
 */
export function personalRecords(sessions: Session[]): Partial<Record<RecordKind, PersonalRecord>> {
  const out: Partial<Record<RecordKind, PersonalRecord>> = {};
  for (const s of [...sessions].sort(byDate)) {
    const m = sessionMetrics(s.sets);
    for (const kind of RECORD_KINDS) {
      const v = m[kind];
      if (v <= 0) continue;
      const cur = out[kind];
      if (!cur || v > cur.value + 1e-9) {
        out[kind] = { kind, value: v, workoutId: s.workoutId, date: s.date, set: bestSet(s.sets, kind) };
      }
    }
  }
  return out;
}

/**
 * Records this workout set: kinds where it beat every earlier session. A first-ever
 * session sets nothing (there was nothing to beat). Later sessions don't matter, so a
 * record stays a record in that workout's summary even after you beat it again.
 */
export function recordsSetIn(sessions: Session[], workoutId: string): PersonalRecord[] {
  const sorted = [...sessions].sort(byDate);
  const i = sorted.findIndex((s) => s.workoutId === workoutId);
  if (i <= 0) return [];
  const before = personalRecords(sorted.slice(0, i));
  const mine = sorted[i];
  const m = sessionMetrics(mine.sets);
  const out: PersonalRecord[] = [];
  for (const kind of RECORD_KINDS) {
    const prev = before[kind]?.value ?? 0;
    if (m[kind] > prev + 1e-9 && prev > 0) {
      out.push({ kind, value: m[kind], workoutId, date: mine.date, set: bestSet(mine.sets, kind) });
    }
  }
  return out;
}

export type Point = { t: number; value: number; workoutId: string };

/** One point per session for a metric, oldest first, from `sinceMs` on. Empty sessions are skipped. */
export function series(sessions: Session[], kind: RecordKind, sinceMs = -Infinity): Point[] {
  const out: Point[] = [];
  for (const s of [...sessions].sort(byDate)) {
    const t = Date.parse(s.date);
    if (t < sinceMs) continue;
    const v = sessionMetrics(s.sets)[kind];
    if (v > 0) out.push({ t, value: v, workoutId: s.workoutId });
  }
  return out;
}

// --- Weeks, streaks and the calendar (local time, weeks start on Monday) ----------

const DAY = 86_400_000;

/** Local midnight of the Monday on or before `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const back = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - back);
  return x;
}

/** "2026-11-26" in local time: the key for a calendar day. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type WorkoutSummary = { startedAt: string; volumeKg: number; durationS: number; sets: number };
export type WeekTotal = { start: Date; workouts: number; volumeKg: number; durationS: number; sets: number };

/** The last `weeks` weeks (oldest first, ending with the current week), with totals. */
export function weeklyTotals(workouts: WorkoutSummary[], weeks: number, now = new Date()): WeekTotal[] {
  const thisWeek = weekStart(now);
  const out: WeekTotal[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * i); // setDate keeps local midnight across DST
    out.push({ start, workouts: 0, volumeKg: 0, durationS: 0, sets: 0 });
  }
  const index = new Map(out.map((w, i) => [w.start.getTime(), i]));
  for (const w of workouts) {
    const i = index.get(weekStart(new Date(w.startedAt)).getTime());
    if (i == null) continue;
    const bucket = out[i];
    bucket.workouts++;
    bucket.volumeKg += w.volumeKg;
    bucket.durationS += w.durationS;
    bucket.sets += w.sets;
  }
  return out;
}

/**
 * Weeks in a row with at least one workout, counting back from this week. This week
 * not having a workout yet doesn't break the streak (it isn't over), so it counts
 * from last week in that case.
 */
export function weekStreak(dates: string[], now = new Date()): number {
  const weeks = new Set(dates.map((d) => weekStart(new Date(d)).getTime()));
  const cursor = weekStart(now);
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
  let n = 0;
  while (weeks.has(cursor.getTime())) {
    n++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return n;
}

/** A month as rows of 7 days (Monday first); days outside the month are null. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Days between two dates, ignoring time of day. */
export const daysBetween = (a: Date, b: Date) =>
  Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / DAY);

// --- Axis ticks ----------------------------------------------------------------

/**
 * "Nice" round axis ticks covering [min, max]: steps of 1, 2, 2.5 or 5 × 10^n.
 * A flat series gets a little room above and below so its line isn't on an edge.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  const nonNegative = min >= 0;
  if (max - min < 1e-9) {
    const pad = Math.max(1, Math.abs(max) * 0.05);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  // Weights and counts are never negative.
  return nonNegative ? ticks.filter((t) => t >= 0) : ticks;
}
