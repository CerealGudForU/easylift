// Someone's exercises (on a profile): each row shows sessions and best set; tap it to
// drop down a chart of that exercise over time (heaviest weight, most reps, est. 1RM).
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { compact } from '@/components/charts/chart-frame';
import { LineChart } from '@/components/charts/line-chart';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/progress-labels';
import { useExerciseHistory, type ExerciseSession, type ProfileExercise } from '@/lib/social';
import { space, useColors } from '@/theme';

const METRICS = {
  weight: {
    label: 'Weight',
    value: (s: ExerciseSession) => s.max_weight_kg ?? 0,
    format: (v: number) => `${formatNumber(v)} kg`,
    help: 'Heaviest set each session',
  },
  reps: {
    label: 'Reps',
    value: (s: ExerciseSession) => s.max_reps ?? 0,
    format: (v: number) => `${v} reps`,
    help: 'Most reps in a set each session',
  },
  e1rm: {
    label: 'Est. 1RM',
    value: (s: ExerciseSession) => s.e1rm ?? 0,
    format: (v: number) => `${formatNumber(v)} kg`,
    help: 'Best set as an estimated one-rep max',
  },
} as const;
type Metric = keyof typeof METRICS;

const bestSet = (w: number | null, r: number | null) => (w ? `${formatNumber(w)} kg × ${r ?? 0}` : `${r ?? 0} reps`);

/** The rows; one can be open at a time. */
export function ExerciseList({ userId, exercises }: { userId: string; exercises: ProfileExercise[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View>
      {exercises.map((x) => (
        <ExerciseRow
          key={x.exercise_id}
          userId={userId}
          x={x}
          open={open === x.exercise_id}
          onToggle={() => setOpen(open === x.exercise_id ? null : x.exercise_id)}
        />
      ))}
    </View>
  );
}

function ExerciseRow({ userId, x, open, onToggle }: { userId: string; x: ProfileExercise; open: boolean; onToggle: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${x.name}, ${x.sessions} sessions, best ${bestSet(x.best_weight_kg, x.best_reps)}. ${open ? 'Hide' : 'Show'} chart`}
        style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.flex}>
          <Text variant="headline" numberOfLines={1}>
            {x.name}
          </Text>
          <Text variant="label" tone="textMuted">
            {x.sessions} {x.sessions === 1 ? 'session' : 'sessions'}
            {x.best_e1rm ? ` · est. 1RM ${formatNumber(x.best_e1rm)} kg` : ''}
          </Text>
        </View>
        <Text variant="stat">{bestSet(x.best_weight_kg, x.best_reps)}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={c.textMuted} />
      </Pressable>
      {open ? <ExerciseChart userId={userId} exerciseId={x.exercise_id} name={x.name} /> : null}
    </View>
  );
}

function ExerciseChart({ userId, exerciseId, name }: { userId: string; exerciseId: string; name: string }) {
  const c = useColors();
  const q = useExerciseHistory(userId, exerciseId);
  const [metric, setMetric] = useState<Metric>('weight');
  const [picked, setPicked] = useState<number | null>(null);
  const sessions = q.data ?? [];
  const m = METRICS[metric];
  const points = sessions.map((s) => ({ t: Date.parse(s.started_at), value: m.value(s), workoutId: s.workout_id }));
  const selected = picked ?? points.length - 1;
  const sel = sessions[selected];

  if (q.isPending) return <ActivityIndicator color={c.accent} style={styles.pad} />;
  if (q.isError || !sessions.length) {
    return (
      <Text variant="label" tone="textMuted" style={styles.pad}>
        {q.isError ? "Can't load this chart. Check your connection." : 'No sessions to chart.'}
      </Text>
    );
  }
  const first = points[0].value;
  const last = points[points.length - 1].value;

  return (
    <View style={styles.chart}>
      <View style={styles.chips}>
        {(Object.keys(METRICS) as Metric[]).map((k) => (
          <Chip
            key={k}
            label={METRICS[k].label}
            selected={metric === k}
            onPress={() => {
              setMetric(k);
              setPicked(null);
            }}
          />
        ))}
      </View>
      <View style={styles.readout}>
        <Text variant="numeric">{m.format(points[selected].value)}</Text>
        <Text variant="label" tone="textMuted">
          {formatShortDate(sel.started_at)} · best set {bestSet(sel.best_weight_kg, sel.best_reps)}
        </Text>
      </View>
      <LineChart
        points={points}
        selected={selected}
        onSelect={setPicked}
        formatTick={compact}
        formatDate={(t) => formatShortDate(t)}
        accessibilityLabel={`${name}, ${m.help.toLowerCase()}: ${points.length} sessions, from ${m.format(first)} to ${m.format(last)}`}
      />
      <Text variant="caption" tone="textMuted">
        {m.help}. Tap or drag the chart to read a session.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingVertical: space.md },
  row: { borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  chart: { gap: space.sm, paddingBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  readout: { gap: 2 },
});
