// Statistics tab: the most improved exercise of the last 30 days (with its chart), then
// every exercise you've logged, most recent first, with its best and its 30-day change.
// Each opens its progress (PRs and charts).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { compact } from '@/components/charts/chart-frame';
import { LineChart } from '@/components/charts/line-chart';
import { ChangeBadge } from '@/components/progress/change-badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { dependsOn, exerciseSessions, usePerformedExercises, useWorkoutData, type PerformedExercise } from '@/lib/data/queries';
import { equipmentLabel } from '@/lib/exercise-labels';
import { formatWorkoutDate } from '@/lib/format';
import { series } from '@/lib/progress';
import { formatMetric, formatShortDate } from '@/lib/progress-labels';
import { fonts, radius, size, space, useColors } from '@/theme';

export default function StatisticsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const all = usePerformedExercises();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((x) => {
      const hay = `${x.exercise.name} ${equipmentLabel(x.exercise.equipment)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [all, query]);

  // The biggest gain in the last 30 days (only gains count as "improved").
  const top = useMemo(() => {
    let best: PerformedExercise | null = null;
    for (const x of all) if (x.change && x.change.pct > 0 && (!best || x.change.pct > best.change!.pct)) best = x;
    return best;
  }, [all]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.exercise.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: space.huge }]}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text variant="title" accessibilityRole="header">
              Statistics
            </Text>
            {top && !query ? <MostImproved item={top} /> : null}
            {all.length > 0 ? (
              <View style={[styles.search, { backgroundColor: c.field }]}>
                <Icon name="magnify" size={20} color={c.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search your exercises"
                  placeholderTextColor={c.textMuted}
                  selectionColor={c.accent}
                  cursorColor={c.accent}
                  accessibilityLabel="Search your exercises"
                  style={[styles.input, { color: c.text }]}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: c.surface }]}>
            <Icon name="dumbbell" size={28} color={c.accent} />
            <Text variant="body" tone="textSecondary" style={styles.center}>
              {all.length ? 'No exercises match your search.' : 'Exercises you log show up here, with their progress.'}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => {
          const weighted = item.best.e1rm > 0;
          const best = weighted ? formatMetric('e1rm', item.best.e1rm) : formatMetric('reps', item.best.reps);
          const change = item.change ? `, ${item.change.pct > 0 ? 'up' : item.change.pct < 0 ? 'down' : 'no change,'} ${Math.abs(item.change.pct)} percent in 30 days` : '';
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.exercise.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.exercise.name}, ${item.sessions} sessions, best ${weighted ? 'estimated one-rep max' : 'reps'} ${best}${change}`}
              style={({ pressed }) => [styles.row, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
              <View style={styles.flex}>
                <Text variant="headline" numberOfLines={1}>
                  {item.exercise.name}
                </Text>
                <Text variant="caption" tone="textMuted" numberOfLines={1}>
                  {item.sessions} {item.sessions === 1 ? 'session' : 'sessions'} · last {formatWorkoutDate(item.lastDate).split(',')[0]}
                </Text>
                {item.change ? <ChangeBadge change={item.change} suffix=" in 30 days" /> : null}
              </View>
              <View style={styles.best}>
                <Text variant="stat">{best}</Text>
                <Text variant="caption" tone="textMuted">
                  {weighted ? 'EST. 1RM' : 'BEST SET'}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={c.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** The most improved exercise: its gain and a chart of the sessions behind it. */
function MostImproved({ item }: { item: PerformedExercise }) {
  const c = useColors();
  const data = useWorkoutData();
  const change = item.change!;
  const id = item.exercise.id;
  const points = useMemo(() => {
    dependsOn(data); // recompute when workout data changes
    return series(exerciseSessions(id), change.metric, Date.parse(change.fromDate));
  }, [data, id, change.metric, change.fromDate]);
  const [chosen, setChosen] = useState<number | null>(null);
  const selected = chosen != null && chosen < points.length ? chosen : points.length - 1;
  const point = points[selected];
  const open = () => router.push({ pathname: '/exercises/[id]', params: { id } });
  const unit = change.metric === 'weight' ? 'Heaviest weight' : 'Most reps';

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Most improved in the last 30 days: ${item.exercise.name}, ${unit.toLowerCase()} from ${formatMetric(change.metric, change.from)} to ${formatMetric(change.metric, change.to)}. Open its progress`}
        style={({ pressed }) => [styles.cardHead, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.flex}>
          <Text variant="caption" tone="accent">
            MOST IMPROVED · LAST 30 DAYS
          </Text>
          <Text variant="headline" numberOfLines={1}>
            {item.exercise.name}
          </Text>
          <Text variant="label" tone="textSecondary">
            {unit} {formatMetric(change.metric, change.from)} → {formatMetric(change.metric, change.to)}
          </Text>
        </View>
        <ChangeBadge change={change} size="large" />
        <Icon name="chevron-right" size={22} color={c.textMuted} />
      </Pressable>
      {points.length > 1 ? (
        <>
          <LineChart
            points={points}
            selected={selected}
            onSelect={setChosen}
            formatTick={compact}
            formatDate={(t) => formatShortDate(t)}
            accessibilityLabel={`${unit} chart for ${item.exercise.name}: ${points.map((p) => `${formatMetric(change.metric, p.value)} on ${formatShortDate(p.t)}`).join(', ')}`}
          />
          {point ? (
            <Text variant="caption" tone="textMuted">
              {formatMetric(change.metric, point.value)} on {formatShortDate(point.t)}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg },
  head: { gap: space.lg, marginBottom: space.lg },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: size.touch },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: space.sm, outlineWidth: 0 },
  empty: { alignItems: 'center', gap: space.md, padding: space.xl, borderRadius: radius.card },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', minHeight: 64 },
  flex: { flex: 1, gap: 2 },
  best: { alignItems: 'flex-end' },
});
