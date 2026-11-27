// One exercise's progress: a chart of the chosen metric over time, personal records,
// and every session (newest first), which doubles as the chart's table view.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { compact } from '@/components/charts/chart-frame';
import { LineChart } from '@/components/charts/line-chart';
import { ChangeBadge } from '@/components/progress/change-badge';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { setLabels } from '@/components/workout/types';
import { dependsOn, exerciseSessions, useWorkoutData } from '@/lib/data/queries';
import { equipmentLabel, muscleLabel } from '@/lib/exercise-labels';
import { formatNumber, formatWorkoutDate } from '@/lib/format';
import { personalRecords, recentChange, RECORD_KINDS, series, type RecordKind } from '@/lib/progress';
import {
  formatMetric,
  formatRecordSet,
  formatShortDate,
  METRIC_CHIP,
  METRIC_HELP,
  RECORD_LABEL,
} from '@/lib/progress-labels';
import { radius, space, useColors } from '@/theme';

const RANGES = [
  { key: '1m', label: '1M', months: 1 },
  { key: '3m', label: '3M', months: 3 },
  { key: '1y', label: '1Y', months: 12 },
  { key: 'all', label: 'All', months: 0 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

/** Chart metrics in chip order: strength first, then size of work. */
const METRICS: RecordKind[] = ['e1rm', 'weight', 'setVolume', 'volume', 'reps'];

export default function ExerciseProgressScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useWorkoutData();
  const exercise = data.e.get(id);

  const sessions = useMemo(() => {
    dependsOn(data); // recompute when workout data changes
    return exerciseSessions(id);
  }, [data, id]);
  const records = useMemo(() => personalRecords(sessions), [sessions]);
  // Same 30-day change as on the Statistics tab.
  const change = useMemo(() => recentChange(sessions), [sessions]);
  // Weighted exercises chart strength; bodyweight ones (no weight logged) chart reps.
  const available = useMemo(() => METRICS.filter((k) => records[k]), [records]);
  const [metricChoice, setMetric] = useState<RecordKind | null>(null);
  const metric = metricChoice && available.includes(metricChoice) ? metricChoice : (available[0] ?? 'reps');
  const [range, setRange] = useState<RangeKey>('all');
  const [selectedChoice, setSelected] = useState<number | null>(null);

  const points = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)?.months ?? 0;
    let since = -Infinity;
    if (months) {
      const d = new Date();
      d.setMonth(d.getMonth() - months);
      since = d.getTime();
    }
    return series(sessions, metric, since);
  }, [sessions, metric, range]);
  const selected = selectedChoice != null && selectedChoice < points.length ? selectedChoice : points.length - 1;
  const point = points[selected];
  const first = points[0];

  const pick = (fn: () => void) => {
    fn();
    setSelected(null); // back to the latest point
  };

  const history = useMemo(() => [...sessions].reverse(), [sessions]);

  if (!exercise) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScreenHeader />
        <Text variant="body" tone="textSecondary" style={styles.pad}>
          This exercise isn&apos;t available.
        </Text>
      </View>
    );
  }

  const subtitle = [exercise.equipment && equipmentLabel(exercise.equipment), exercise.primary_muscle && muscleLabel(exercise.primary_muscle)]
    .filter(Boolean)
    .join(' · ');
  const openWorkout = (workoutId: string) => router.push({ pathname: '/workout/[id]', params: { id: workoutId } });

  const summary =
    points.length > 0
      ? `${METRIC_CHIP[metric]} chart, ${points.length} ${points.length === 1 ? 'session' : 'sessions'}, from ${formatMetric(metric, first.value)} on ${formatShortDate(first.t)} to ${formatMetric(metric, points[points.length - 1].value)} on ${formatShortDate(points[points.length - 1].t)}, best ${formatMetric(metric, Math.max(...points.map((p) => p.value)))}.`
      : 'No sessions in this range.';

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.titleBlock}>
          <Text variant="title" accessibilityRole="header">
            {exercise.name}
          </Text>
          {subtitle ? (
            <Text variant="label" tone="textMuted">
              {subtitle}
            </Text>
          ) : null}
          {change ? (
            <ChangeBadge change={change} suffix={change.metric === 'weight' ? ' heaviest weight in 30 days' : ' most reps in 30 days'} />
          ) : null}
        </View>

        {sessions.length === 0 ? (
          <View style={[styles.card, styles.empty, { backgroundColor: c.surface }]}>
            <Icon name="chart-line" size={28} color={c.accent} />
            <Text variant="body" tone="textSecondary" style={styles.center}>
              Finish a workout with this exercise to see your progress here.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.readout}>
                <Text variant="display">{point ? formatMetric(metric, point.value) : '–'}</Text>
                <Text variant="label" tone="textSecondary">
                  {point ? formatShortDate(point.t) : 'No sessions in this range'}
                  {point && first && point !== first && point.value !== first.value
                    ? `  ·  ${point.value > first.value ? '+' : '−'}${formatMetric(metric, Math.abs(point.value - first.value))} since ${formatShortDate(first.t)}`
                    : ''}
                </Text>
              </View>

              {points.length ? (
                <LineChart
                  points={points}
                  selected={selected}
                  onSelect={setSelected}
                  formatTick={compact}
                  formatDate={(t) => formatShortDate(t)}
                  accessibilityLabel={summary}
                />
              ) : (
                <View style={styles.noRange}>
                  <Text variant="body" tone="textMuted">
                    No sessions in this range.
                  </Text>
                </View>
              )}

              <Text variant="caption" tone="textMuted">
                {METRIC_HELP[metric]}
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {available.map((k) => (
                  <Chip key={k} label={METRIC_CHIP[k]} selected={k === metric} onPress={() => pick(() => setMetric(k))} />
                ))}
              </ScrollView>
              <View style={styles.chipsRow}>
                {RANGES.map((r) => (
                  <Chip key={r.key} label={r.label} selected={r.key === range} onPress={() => pick(() => setRange(r.key))} />
                ))}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.sectionHead}>
                <Icon name="trophy" size={20} color={c.accent} />
                <Text variant="headline">Personal records</Text>
              </View>
              {RECORD_KINDS.map((k) => {
                const r = records[k];
                if (!r) return null;
                const detail = [formatRecordSet(r), formatShortDate(r.date)].filter(Boolean).join(' · ');
                return (
                  <Pressable
                    key={k}
                    onPress={() => openWorkout(r.workoutId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${RECORD_LABEL[k]}: ${formatMetric(k, r.value)}, ${detail}`}
                    style={({ pressed }) => [styles.recordRow, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={styles.flex}>
                      <Text variant="body">{RECORD_LABEL[k]}</Text>
                      <Text variant="caption" tone="textMuted">
                        {detail}
                      </Text>
                    </View>
                    <Text variant="stat">{formatMetric(k, r.value)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text variant="headline" style={styles.section}>
              History
            </Text>
            {history.map((s) => {
              const w = data.w.get(s.workoutId);
              const labels = setLabels(s.sets.map((x, i) => ({ id: String(i), type: x.type as never, weightKg: null, reps: null, done: true })));
              return (
                <Pressable
                  key={s.workoutId}
                  onPress={() => openWorkout(s.workoutId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${w?.title ?? 'Workout'}, ${formatWorkoutDate(s.date)}`}
                  style={({ pressed }) => [styles.card, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                  <View style={styles.sessionHead}>
                    <Text variant="headline" style={styles.flex} numberOfLines={1}>
                      {w?.title ?? 'Workout'}
                    </Text>
                    <Text variant="label" tone="textMuted">
                      {formatWorkoutDate(s.date)}
                    </Text>
                  </View>
                  {s.sets.map((x, i) => (
                    <View key={i} style={styles.setRow}>
                      <Text
                        variant="label"
                        style={[
                          styles.setLabel,
                          { color: x.type === 'warmup' ? c.setWarmup : x.type === 'drop' ? c.setDrop : x.type === 'failure' ? c.danger : c.textMuted },
                        ]}>
                        {labels[i]}
                      </Text>
                      <Text variant="body" style={styles.flex}>
                        {x.weightKg ? `${formatNumber(x.weightKg)} kg × ${x.reps ?? 0}` : `${x.reps ?? 0} reps`}
                      </Text>
                    </View>
                  ))}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { padding: space.lg },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  titleBlock: { gap: 2 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  empty: { alignItems: 'center' },
  center: { textAlign: 'center' },
  readout: { gap: 2 },
  noRange: { height: 120, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: space.sm },
  chipsRow: { flexDirection: 'row', gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  flex: { flex: 1 },
  section: { marginTop: space.sm },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  setLabel: { width: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
