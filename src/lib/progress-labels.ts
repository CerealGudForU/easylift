// How progress numbers are named and written in the UI.
import { formatNumber } from './format';
import type { PersonalRecord, RecordKind } from './progress';

export const RECORD_LABEL: Record<RecordKind, string> = {
  e1rm: 'Est. 1RM',
  weight: 'Heaviest weight',
  setVolume: 'Best set',
  volume: 'Session volume',
  reps: 'Most reps',
};

/** Short names for chart metric chips. */
export const METRIC_CHIP: Record<RecordKind, string> = {
  e1rm: 'Est. 1RM',
  weight: 'Heaviest',
  setVolume: 'Best set',
  volume: 'Volume',
  reps: 'Reps',
};

/** What each metric means, for the chart's caption. */
export const METRIC_HELP: Record<RecordKind, string> = {
  e1rm: 'Estimated one-rep max from your best set (Epley formula), in kg',
  weight: 'Heaviest weight you lifted each session, in kg',
  setVolume: 'Best single set, weight × reps, in kg',
  volume: 'Total weight × reps each session (warm-ups excluded), in kg',
  reps: 'Most reps in one set each session',
};

/** "65 kg", "15 reps", "1,740 kg". */
export function formatMetric(kind: RecordKind, value: number): string {
  if (kind === 'reps') return `${formatNumber(value)} ${value === 1 ? 'rep' : 'reps'}`;
  // Volumes are whole kilograms, like the workout totals; weights keep a decimal (82.5).
  const v = kind === 'volume' || kind === 'setVolume' ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatNumber(v)} kg`;
}

/** The set behind a record, e.g. "62.5 kg × 8", or "" when there's no single set. */
export function formatRecordSet(r: PersonalRecord): string {
  // A bodyweight rep record would just repeat its own value.
  if (!r.set || (r.kind === 'reps' && r.set.weightKg <= 0)) return '';
  return r.set.weightKg > 0 ? `${formatNumber(r.set.weightKg)} kg × ${r.set.reps}` : `${r.set.reps} reps`;
}

/** "5 Oct", or "5 Oct 2025" outside the current year. */
export function formatShortDate(t: number | string, now = new Date()): string {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}
