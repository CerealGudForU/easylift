// Profile's training overview: the last 12 weeks as columns (workouts, volume or
// time), with the tapped week read out above the chart.
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/bar-chart';
import { compact } from '@/components/charts/chart-frame';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { formatDuration, formatNumber } from '@/lib/format';
import { weeklyTotals, type WorkoutSummary } from '@/lib/progress';
import { formatShortDate } from '@/lib/progress-labels';
import { radius, space, useColors } from '@/theme';

const WEEKS = 12;

const METRICS = {
  workouts: {
    label: 'Workouts',
    value: (w: { workouts: number }) => w.workouts,
    format: (v: number) => `${v} ${v === 1 ? 'workout' : 'workouts'}`,
    tick: (v: number) => String(v),
  },
  volume: {
    label: 'Volume',
    value: (w: { volumeKg: number }) => Math.round(w.volumeKg),
    format: (v: number) => `${formatNumber(v)} kg`,
    tick: compact,
  },
  duration: {
    label: 'Time',
    value: (w: { durationS: number }) => w.durationS / 3600,
    format: (v: number) => (v > 0 ? formatDuration(v * 3600) : '0m'),
    tick: (v: number) => `${compact(v)}h`,
  },
} as const;
type Metric = keyof typeof METRICS;

export function WeeklyCard({ workouts }: { workouts: WorkoutSummary[] }) {
  const c = useColors();
  const [metric, setMetric] = useState<Metric>('workouts');
  const [selected, setSelected] = useState(WEEKS - 1);
  const weeks = useMemo(() => weeklyTotals(workouts, WEEKS), [workouts]);
  const m = METRICS[metric];
  const values = weeks.map((w) => m.value(w));
  const week = weeks[selected];
  const isThisWeek = selected === WEEKS - 1;
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.readout}>
        <Text variant="caption" tone="textMuted">
          {isThisWeek ? 'THIS WEEK' : `WEEK OF ${formatShortDate(week.start.getTime()).toUpperCase()}`}
        </Text>
        <Text variant="display">{m.format(values[selected])}</Text>
      </View>
      <BarChart
        values={values}
        labels={weeks.map((w) => formatShortDate(w.start.getTime()))}
        labelEvery={4}
        selected={selected}
        onSelect={setSelected}
        formatTick={m.tick}
        accessibilityLabel={`${m.label} per week, last ${WEEKS} weeks: ${weeks
          .map((w, i) => `week of ${formatShortDate(w.start.getTime())}, ${m.format(values[i])}`)
          .join('; ')}. Total ${m.format(total)}.`}
      />
      <View style={styles.chips}>
        {(Object.keys(METRICS) as Metric[]).map((k) => (
          <Chip key={k} label={METRICS[k].label} selected={k === metric} onPress={() => setMetric(k)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  readout: { gap: 2 },
  chips: { flexDirection: 'row', gap: space.sm },
});
