// Training calendar: a month grid with your workout days marked, your weekly streak, and
// the workouts on the chosen day.
// - "Friends": dots under each day show which friends trained then (one colour each).
// - Days where you added a photo have a white underline. Tapping one shows a small
//   preview of the photo; tapping it again opens that day's post.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CroppedImage } from '@/components/social/workout-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useWorkoutSummaries } from '@/lib/data/queries';
import { formatDuration, formatNumber } from '@/lib/format';
import { dayKey, monthGrid, weekStart, weekStreak } from '@/lib/progress';
import { useSession } from '@/lib/session';
import { useCalendar, type CalendarEntry } from '@/lib/social';
import { radius, space, useColors } from '@/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// One colour per friend, chosen to stay apart from the orange of your own days.
const FRIEND_COLORS = ['#38BDF8', '#A78BFA', '#34D399', '#F472B6', '#FACC15', '#94A3B8'];
const MAX_DOTS = 4;
const PREVIEW = 92;

export default function CalendarScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const me = useSession().session?.user.id;
  const workouts = useWorkoutSummaries();
  const today = new Date();
  const [month, setMonth] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [chosen, setChosen] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const byDay = useMemo(() => {
    const m = new Map<string, typeof workouts>();
    for (const w of workouts) {
      const k = dayKey(new Date(w.startedAt));
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [workouts]);

  // Friends' days and your photos come from the server (saved for offline).
  const range = useMemo(() => ({ from: new Date(month.y, month.m, 1), to: new Date(month.y, month.m + 1, 1) }), [month]);
  const server = useCalendar(range.from, range.to);

  const { friends, friendDays, photoDays } = useMemo(() => {
    const friendDays = new Map<string, Set<string>>(); // day → friend ids
    const photoDays = new Map<string, CalendarEntry>(); // day → your first workout with a photo
    const names = new Map<string, string>();
    for (const e of server.data ?? []) {
      const k = dayKey(new Date(e.started_at));
      if (e.owner_id === me) {
        if (e.photo && !photoDays.has(k)) photoDays.set(k, e);
        continue;
      }
      names.set(e.owner_id, e.username);
      if (!friendDays.has(k)) friendDays.set(k, new Set());
      friendDays.get(k)!.add(e.owner_id);
    }
    const friends = [...names.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, username], i) => ({ id, username, color: FRIEND_COLORS[i % FRIEND_COLORS.length] }));
    return { friends, friendDays, photoDays };
  }, [server.data, me]);
  const friendColor = new Map(friends.map((f) => [f.id, f.color]));

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
    setPreview(null);
  };

  const pressDay = (k: string) => {
    const photo = photoDays.get(k);
    // Second tap on a photo day opens the post.
    if (photo && preview === k) {
      setPreview(null);
      router.push({ pathname: '/post/[id]', params: { id: photo.workout_id } });
      return;
    }
    setChosen(k);
    setPreview(photo ? k : null);
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
  const dayFriends =
    showFriends && shownDay
      ? friends.filter((f) => !hidden.has(f.id) && friendDays.get(shownDay)?.has(f.id))
      : [];

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: space.huge }]}>
        <View style={styles.titleRow}>
          <Text variant="title" accessibilityRole="header" style={styles.flex}>
            Calendar
          </Text>
          <Pressable
            onPress={() => setShowFriends((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showFriends }}
            accessibilityLabel="Show the days your friends trained"
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: showFriends ? c.accent : c.field, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Icon name="account-group-outline" size={18} color={showFriends ? c.onAccent : c.text} />
            <Text variant="label" style={{ color: showFriends ? c.onAccent : c.text }}>
              Friends
            </Text>
          </Pressable>
        </View>

        <View style={[styles.stats, { backgroundColor: c.surface }]}>
          <Stat label="Week streak" value={String(stats.streak)} />
          <Stat label="This week" value={String(stats.week)} />
          <Stat label="This month" value={String(stats.monthCount)} />
        </View>

        {showFriends ? (
          <View style={styles.legend}>
            {friends.length === 0 ? (
              <Text variant="label" tone="textMuted">
                {server.isPending ? 'Loading your friends…' : server.isError ? "Can't load your friends' days right now." : 'None of your friends trained this month.'}
              </Text>
            ) : (
              friends.map((f) => {
                const off = hidden.has(f.id);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() =>
                      setHidden((h) => {
                        const next = new Set(h);
                        if (off) next.delete(f.id);
                        else next.add(f.id);
                        return next;
                      })
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !off }}
                    accessibilityLabel={`Show ${f.username}'s days`}
                    style={({ pressed }) => [styles.friendChip, { backgroundColor: c.field, opacity: pressed ? 0.75 : off ? 0.45 : 1 }]}>
                    <View style={[styles.legendDot, { backgroundColor: f.color }]} />
                    <Text variant="label">{f.username}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

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
            // Later rows draw over earlier ones, so a preview (which pops up over the row above) stays on top.
            <View key={r} style={styles.week}>
              {row.map((d, i) => {
                if (!d) return <View key={i} style={styles.cell} />;
                const k = dayKey(d);
                const count = byDay.get(k)?.length ?? 0;
                const isToday = k === dayKey(today);
                const isShown = k === shownDay;
                const photo = photoDays.get(k);
                const dots = showFriends ? [...(friendDays.get(k) ?? [])].filter((id) => !hidden.has(id)) : [];
                const friendNames = dots.map((id) => friends.find((f) => f.id === id)?.username).filter(Boolean);
                return (
                  <View key={i} style={styles.cell}>
                    <Pressable
                      onPress={() => pressDay(k)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isShown }}
                      accessibilityLabel={[
                        `${WEEKDAY_NAMES[i]} ${d.getDate()}${isToday ? ', today' : ''}`,
                        count ? `${count} ${count === 1 ? 'workout' : 'workouts'}` : 'rest day',
                        photo ? (preview === k ? 'with a photo, tap again to open the post' : 'with a photo') : '',
                        friendNames.length ? `friends: ${friendNames.join(', ')}` : '',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      style={styles.dayHit}>
                      <View
                        style={[
                          styles.day,
                          count ? { backgroundColor: c.accent } : null,
                          isShown || isToday ? { borderWidth: 2, borderColor: isShown ? c.text : c.accent } : null,
                        ]}>
                        <Text variant="label" style={{ color: count ? c.onAccent : c.textSecondary }}>
                          {d.getDate()}
                        </Text>
                        {photo ? <View style={styles.underline} /> : null}
                      </View>
                      <View style={styles.dots}>
                        {dots.slice(0, MAX_DOTS).map((id) => (
                          <View key={id} style={[styles.dot, { backgroundColor: friendColor.get(id) }]} />
                        ))}
                      </View>
                    </Pressable>
                    {photo?.photo && preview === k ? (
                      <Pressable
                        onPress={() => pressDay(k)}
                        accessibilityRole="button"
                        accessibilityLabel={`Photo from ${photo.title}. Open the post`}
                        style={[
                          styles.preview,
                          i === 0 ? { left: 0 } : i === 6 ? { right: 0 } : { left: '50%', marginLeft: -PREVIEW / 2 },
                          { borderColor: c.text, backgroundColor: c.field },
                        ]}>
                        <CroppedImage photo={photo.photo} width={PREVIEW - 4} height={PREVIEW - 4} />
                        <View style={styles.previewLabel}>
                          <Text variant="caption" style={styles.previewText} numberOfLines={1}>
                            Tap to open
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
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
        {dayFriends.length ? (
          <View style={styles.alsoTrained}>
            <Text variant="label" tone="textMuted">
              Friends who trained
            </Text>
            {dayFriends.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${f.username} trained this day. Open their profile`}
                style={({ pressed }) => [styles.friendRow, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.legendDot, { backgroundColor: f.color }]} />
                <Text variant="headline" style={styles.flex} numberOfLines={1}>
                  {f.username}
                </Text>
                <Icon name="chevron-right" size={22} color={c.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.pill },
  stats: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: radius.card, paddingVertical: space.lg },
  stat: { alignItems: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.xs },
  friendChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, minHeight: 36, borderRadius: radius.pill },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.xs },
  monthHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthName: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  dayHit: { alignItems: 'center', gap: 3, minWidth: 44, minHeight: 50, justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  underline: { position: 'absolute', bottom: 6, width: 16, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF' },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  preview: {
    position: 'absolute',
    bottom: '88%',
    zIndex: 10,
    width: PREVIEW,
    height: PREVIEW,
    borderRadius: radius.control,
    borderWidth: 2,
    overflow: 'hidden',
    boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
  },
  previewLabel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  previewText: { color: '#FAFAFA', textAlign: 'center', textTransform: 'none' },
  section: { marginTop: space.sm },
  flex: { flex: 1, gap: 2 },
  workout: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  alsoTrained: { gap: space.sm },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
});
