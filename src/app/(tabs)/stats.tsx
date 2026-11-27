// Statistics tab: every exercise you've logged, most recent first, with its best.
// Opens its progress (PRs and charts).
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePerformedExercises } from '@/lib/data/queries';
import { equipmentLabel } from '@/lib/exercise-labels';
import { formatWorkoutDate } from '@/lib/format';
import { formatMetric } from '@/lib/progress-labels';
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
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.exercise.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.exercise.name}, ${item.sessions} sessions, best ${weighted ? 'estimated one-rep max' : 'reps'} ${best}`}
              style={({ pressed }) => [styles.row, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
              <View style={styles.flex}>
                <Text variant="headline" numberOfLines={1}>
                  {item.exercise.name}
                </Text>
                <Text variant="caption" tone="textMuted" numberOfLines={1}>
                  {item.sessions} {item.sessions === 1 ? 'session' : 'sessions'} · last {formatWorkoutDate(item.lastDate).split(',')[0]}
                </Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg },
  head: { gap: space.lg, marginBottom: space.lg },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: size.touch },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: space.sm, outlineWidth: 0 },
  empty: { alignItems: 'center', gap: space.md, padding: space.xl, borderRadius: radius.card },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', minHeight: 64 },
  flex: { flex: 1, gap: 2 },
  best: { alignItems: 'flex-end' },
});
