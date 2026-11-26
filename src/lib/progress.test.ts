import { describe, expect, it } from 'vitest';

import {
  dayKey,
  e1rm,
  monthGrid,
  niceTicks,
  personalRecords,
  recordsSetIn,
  series,
  sessionMetrics,
  weeklyTotals,
  weekStart,
  weekStreak,
  type ProgressSet,
  type Session,
} from './progress';

const set = (weightKg: number | null, reps: number | null, type = 'normal'): ProgressSet => ({ weightKg, reps, type });

// A bench press history: steady progress, one week off, a rep PR at lower weight.
const bench: Session[] = [
  { workoutId: 'w1', date: '2026-10-05T18:00:00Z', sets: [set(40, 10, 'warmup'), set(60, 8), set(60, 8), set(60, 7)] },
  { workoutId: 'w2', date: '2026-10-12T18:00:00Z', sets: [set(62.5, 8), set(62.5, 7), set(60, 8)] },
  // Out of order on purpose: functions must sort by date.
  { workoutId: 'w4', date: '2026-10-26T18:00:00Z', sets: [set(65, 6), set(50, 15), set(50, 12)] },
  { workoutId: 'w3', date: '2026-10-19T18:00:00Z', sets: [set(62.5, 8), set(62.5, 8), set(62.5, 8)] },
];

describe('e1rm (Epley)', () => {
  it('matches the formula', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 3);
    expect(e1rm(60, 10)).toBe(80);
    expect(e1rm(100, 0)).toBe(0);
    expect(e1rm(0, 20)).toBe(0);
  });
});

describe('sessionMetrics', () => {
  it('ignores warm-ups and empty sets', () => {
    const m = sessionMetrics([set(100, 10, 'warmup'), set(60, 8), set(70, 0), set(65, 5, 'failure')]);
    expect(m).toEqual({ weight: 65, e1rm: 76, setVolume: 480, volume: 805, reps: 8, sets: 2 });
  });
  it('handles bodyweight sets (no weight)', () => {
    const m = sessionMetrics([set(null, 12), set(null, 10)]);
    expect(m).toMatchObject({ weight: 0, e1rm: 0, setVolume: 0, volume: 0, reps: 12, sets: 2 });
  });
});

describe('personalRecords', () => {
  const prs = personalRecords(bench);
  it('finds each all-time best and where it happened', () => {
    expect(prs.weight).toMatchObject({ value: 65, workoutId: 'w4', set: { weightKg: 65, reps: 6 } });
    // 62.5 × 8 = 79.17 beats 65 × 6 = 78 and 50 × 15 = 75.
    expect(prs.e1rm).toMatchObject({ value: 79.2, workoutId: 'w2', set: { weightKg: 62.5, reps: 8 } });
    expect(prs.setVolume).toMatchObject({ value: 750, workoutId: 'w4', set: { weightKg: 50, reps: 15 } });
    expect(prs.reps).toMatchObject({ value: 15, workoutId: 'w4' });
    // 65 × 6 + 50 × 15 + 50 × 12 = 1740.
    expect(prs.volume).toMatchObject({ value: 1740, workoutId: 'w4', set: null });
  });
  it('keeps the record with the first session to reach it', () => {
    // w3 matched w2's e1RM (62.5 × 8) but didn't beat it.
    expect(prs.e1rm?.workoutId).toBe('w2');
  });
  it('leaves out kinds with nothing to show', () => {
    const bw = personalRecords([{ workoutId: 'b', date: '2026-10-01', sets: [set(null, 20)] }]);
    expect(Object.keys(bw)).toEqual(['reps']);
    expect(personalRecords([])).toEqual({});
  });
});

describe('recordsSetIn', () => {
  it('a first session sets no records', () => {
    expect(recordsSetIn(bench, 'w1')).toEqual([]);
  });
  it('lists what beat every earlier session', () => {
    expect(recordsSetIn(bench, 'w2').map((r) => r.kind)).toEqual(['weight', 'e1rm', 'setVolume', 'volume']);
    expect(recordsSetIn(bench, 'w3').map((r) => r.kind)).toEqual(['volume']);
    expect(recordsSetIn(bench, 'w4').map((r) => r.kind)).toEqual(['weight', 'setVolume', 'volume', 'reps']);
  });
  it('is unaffected by later sessions', () => {
    const early = bench.filter((s) => s.workoutId !== 'w4');
    expect(recordsSetIn(early, 'w2')).toEqual(recordsSetIn(bench, 'w2'));
  });
  it('returns nothing for an unknown workout', () => {
    expect(recordsSetIn(bench, 'nope')).toEqual([]);
  });
});

describe('series', () => {
  it('is one point per session, oldest first', () => {
    expect(series(bench, 'weight').map((p) => [p.workoutId, p.value])).toEqual([
      ['w1', 60],
      ['w2', 62.5],
      ['w3', 62.5],
      ['w4', 65],
    ]);
  });
  it('filters by start time', () => {
    expect(series(bench, 'volume', Date.parse('2026-10-15')).map((p) => p.workoutId)).toEqual(['w3', 'w4']);
  });
  it('skips sessions with no value for that metric', () => {
    expect(series([{ workoutId: 'b', date: '2026-10-01', sets: [set(null, 20)] }], 'weight')).toEqual([]);
  });
});

describe('weeks', () => {
  // Wednesday 26 Nov 2026, local time.
  const now = new Date(2026, 10, 26, 12);

  it('weekStart is the Monday at local midnight', () => {
    expect(dayKey(weekStart(now))).toBe('2026-11-23');
    expect(dayKey(weekStart(new Date(2026, 10, 23, 0, 1)))).toBe('2026-11-23'); // Monday itself
    expect(dayKey(weekStart(new Date(2026, 10, 29, 23, 59)))).toBe('2026-11-23'); // Sunday
    expect(weekStart(now).getHours()).toBe(0);
  });

  it('weeklyTotals buckets workouts into the last N weeks', () => {
    const at = (y: number, m: number, d: number) => new Date(y, m, d, 18).toISOString();
    const weeks = weeklyTotals(
      [
        { startedAt: at(2026, 10, 24), volumeKg: 1000, durationS: 3600, sets: 15 },
        { startedAt: at(2026, 10, 26), volumeKg: 500, durationS: 1800, sets: 8 },
        { startedAt: at(2026, 10, 10), volumeKg: 700, durationS: 2400, sets: 10 },
        { startedAt: at(2026, 8, 1), volumeKg: 9999, durationS: 1, sets: 1 }, // too old
      ],
      4,
      now,
    );
    expect(weeks.map((w) => dayKey(w.start))).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(weeks.map((w) => w.workouts)).toEqual([0, 1, 0, 2]);
    expect(weeks[3]).toMatchObject({ volumeKg: 1500, durationS: 5400, sets: 23 });
  });

  it('weekStreak counts back from this week, or last week if this one is empty', () => {
    const at = (m: number, d: number) => new Date(2026, m, d, 18).toISOString();
    expect(weekStreak([], now)).toBe(0);
    expect(weekStreak([at(10, 24), at(10, 17), at(10, 12), at(10, 1)], now)).toBe(3);
    // Nothing this week yet: the streak of the three weeks before still stands.
    expect(weekStreak([at(10, 17), at(10, 12), at(10, 3)], now)).toBe(3);
    // A gap of a whole week breaks it.
    expect(weekStreak([at(10, 24), at(10, 10)], now)).toBe(1);
  });
});

describe('monthGrid', () => {
  it('lays out a month Monday-first', () => {
    const nov = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(nov[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(nov[0][6]?.getDate()).toBe(1);
    expect(nov.flat().filter(Boolean)).toHaveLength(30);
    expect(nov.every((row) => row.length === 7)).toBe(true);
    expect(nov.at(-1)?.filter(Boolean).at(-1)?.getDate()).toBe(30);
  });
  it('handles February in a leap year', () => {
    expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('niceTicks', () => {
  it('rounds to clean steps that cover the data', () => {
    expect(niceTicks(60, 65)).toEqual([60, 62, 64, 66]);
    expect(niceTicks(0, 1500)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(77, 103)).toEqual([70, 80, 90, 100, 110]);
  });
  it('gives a flat series room and never goes negative', () => {
    const t = niceTicks(60, 60);
    expect(t[0]).toBeLessThan(60);
    expect(t.at(-1)).toBeGreaterThan(60);
    expect(niceTicks(0, 0).every((v) => v >= 0)).toBe(true);
  });
});
