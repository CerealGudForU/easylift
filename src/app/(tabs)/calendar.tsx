// Training calendar: a month grid with workout days marked, your weekly streak, and
// the workouts on the chosen day.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkoutSummaries } from '@/lib/data/queries';
import { formatDuration, formatNumber } from '@/lib/format';
import { dayKey, monthGrid, weekStart, weekStreak } from '@/lib/progress';
import { radius, space, useColors } from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function CalendarScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const workouts = useWorkoutSummaries();
  const today = new Date();
  const [month, setMonth] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [chosen, setChosen] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, typeof workouts>();
    for (const w of workouts) {
      const k = dayKey(new Date(w.startedAt));
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [workouts]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisWeek = weekStart(now).getTime();
    let week = 0;
    let monthCount = 0;
    for (const w of workouts) {
      const d = new Date(w.startedAt);
      if (weekStart(d).getTime() === thisWeek) week++;
      if (d.getFullYear() === month.y && d.getMonth() === month.m) monthCount++;
    }
    return { week, monthCount, streak: weekStreak(workouts.map((w) => w.startedAt), now) };
  }, [workouts, month]);

  const grid = monthGrid(month.y, month.m);
  const monthName = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const atCurrent = month.y === today.getFullYear() && month.m === today.getMonth();
  const shift = (n: number) => {
    const d = new Date(month.y, month.m + n, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setChosen(null);
  };

  // The chosen day, else the latest workout day in this month.
  const shownDay =
    chosen ??
    [...byDay.keys()]
      .filter((k) => k.startsWith(`${month.y}-${String(month.m + 1).padStart(2, '0')}`))
      .sort()
      .at(-1) ??
    null;
  const dayWorkouts = shownDay ? (byDay.get(shownDay) ?? []) : [];
  const shownDate = shownDay ? new Date(`${shownDay}T12:00:00`) : null;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: space.huge }]}>
        <Text variant="title" accessibilityRole="header">
          Calendar
        </Text>

        <View style={[styles.stats, { backgroundColor: c.surface }]}>
          <Stat label="Week streak" value={String(stats.streak)} />
          <Stat label="This week" value={String(stats.week)} />
          <Stat label="This month" value={String(stats.monthCount)} />
        </View>

        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.monthHead}>
            <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.nav}>
              <Icon name="chevron-left" size={26} color={c.text} />
            </Pressable>
            <Text variant="headline" style={styles.monthName} accessibilityRole="header">
              {monthName}
            </Text>
            <Pressable
              onPress={() => shift(1)}
              disabled={atCurrent}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: atCurrent }}
              style={[styles.nav, { opacity: atCurrent ? 0.3 : 1 }]}>
              <Icon name="chevron-right" size={26} color={c.text} />
            </Pressable>
          </View>

          <View style={styles.week}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} variant="caption" tone="textMuted" style={styles.weekday} importantForAccessibility="no">
                {d}
              </Text>
            ))}
          </View>
          {grid.map((row, r) => (
            <View key={r} style={styles.week}>
              {row.map((d, i) => {
                if (!d) return <View key={i} style={styles.cell} />;
                const k = dayKey(d);
                const count = byDay.get(k)?.length ?? 0;
                const isToday = k === dayKey(today);
                const isShown = k === shownDay;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setChosen(k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isShown }}
                    accessibilityLabel={`${WEEKDAY_NAMES[i]} ${d.getDate()}${isToday ? ', today' : ''}, ${count ? `${count} ${count === 1 ? 'workout' : 'workouts'}` : 'rest day'}`}
                    style={styles.cell}>
                    <View
                      style={[
                        styles.day,
                        count ? { backgroundColor: c.accent } : null,
                        isShown || isToday ? { borderWidth: 2, borderColor: isShown ? c.text : c.accent } : null,
                      ]}>
                      <Text variant="label" style={{ color: count ? c.onAccent : c.textSecondary }}>
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {shownDate ? (
          <Text variant="headline" style={styles.section}>
            {shownDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        ) : null}
        {shownDay && dayWorkouts.length === 0 ? (
          <Text variant="body" tone="textMuted">
            Rest day.
          </Text>
        ) : null}
        {!shownDay ? (
          <Text variant="body" tone="textMuted">
            No workouts this month.
          </Text>
        ) : null}
        {dayWorkouts.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${w.title}, ${formatDuration(w.durationS)}, ${Math.round(w.volumeKg)} kilograms`}
            style={({ pressed }) => [styles.workout, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.flex}>
              <Text variant="headline" numberOfLines={1}>
                {w.title}
              </Text>
              <Text variant="label" tone="textSecondary">
                {new Date(w.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {formatDuration(w.durationS)} · {formatNumber(Math.round(w.volumeKg))} kg · {w.sets} sets
              </Text>
            </View>
            <Icon name="chevron-right" size={22} color={c.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="display">{value}</Text>
      <Text variant="caption" tone="textMuted">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  stats: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: radius.card, paddingVertical: space.lg },
  stat: { alignItems: 'center' },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.xs },
  monthHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthName: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: space.sm },
  flex: { flex: 1, gap: 2 },
  workout: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
