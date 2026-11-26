import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { signOut } from '@/lib/auth';
import { exercisesOf, useHistory, useWorkoutData, workoutStats } from '@/lib/data/queries';
import { useSyncStatus } from '@/lib/data/sync';
import { formatDuration, formatNumber, formatWorkoutDate } from '@/lib/format';
import { useUsername } from '@/lib/session';
import { radius, space, useColors } from '@/theme';

export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const username = useUsername();
  const history = useHistory();
  const data = useWorkoutData();
  const sync = useSyncStatus();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const rows = useMemo(() => {
    void data;
    return history.map((w) => ({
      id: w.id,
      title: w.title,
      date: formatWorkoutDate(w.started_at),
      stats: workoutStats(w.id),
      names: exercisesOf(w.id)
        .map((x) => data.e.get(x.exercise_id)?.name)
        .filter(Boolean)
        .join(', '),
    }));
  }, [history, data]);

  const syncText =
    sync.pending > 0
      ? `${sync.pending} ${sync.pending === 1 ? 'change' : 'changes'} waiting to sync${sync.state === 'offline' ? ' (offline)' : ''}`
      : sync.state === 'offline'
        ? 'Offline. Your workouts are saved on this device.'
        : 'Everything is synced';

  const header = (
    <View style={styles.headerStack}>
      <Text variant="title">Profile</Text>
      <View style={[styles.card, { backgroundColor: c.surface }]}>
        <View style={[styles.avatar, { backgroundColor: c.field }]}>
          <Text variant="title" tone="accent">
            {(username ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="headline">{username ?? 'Signed in'}</Text>
          <Text variant="caption" tone="textMuted">
            {history.length} {history.length === 1 ? 'workout' : 'workouts'}
          </Text>
        </View>
      </View>
      <View style={styles.syncRow}>
        <Icon
          name={sync.pending > 0 || sync.state === 'offline' ? 'cloud-upload-outline' : 'cloud-check-outline'}
          size={18}
          color={c.textMuted}
        />
        <Text variant="label" tone="textMuted">
          {syncText}
        </Text>
      </View>
      <Text variant="headline" style={styles.section}>
        History
      </Text>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
        data={rows}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: c.surface }]}>
            <Icon name="history" size={28} color={c.accent} />
            <Text variant="body" tone="textSecondary" style={styles.center}>
              Finished workouts show up here.
            </Text>
          </View>
        }
        ListFooterComponent={
          <Button label="Sign out" variant="destructive" icon="logout" onPress={() => setConfirmSignOut(true)} />
        }
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.date}`}
            style={({ pressed }) => [styles.workout, { backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 }]}>
            <View style={styles.workoutHead}>
              <Text variant="headline" style={styles.flex} numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="label" tone="textMuted">
                {item.date}
              </Text>
            </View>
            <Text variant="label" tone="textSecondary" numberOfLines={2}>
              {item.names}
            </Text>
            <View style={styles.statsRow}>
              <MiniStat icon="clock-outline" value={formatDuration(item.stats.durationS)} />
              <MiniStat icon="weight-kilogram" value={`${formatNumber(Math.round(item.stats.volumeKg))} kg`} />
              <MiniStat icon="format-list-numbered" value={`${item.stats.sets} sets`} />
            </View>
          </Pressable>
        )}
      />
      <ActionSheet
        visible={confirmSignOut}
        title="Sign out?"
        message={
          sync.pending > 0
            ? `${sync.pending} changes haven't synced yet. They stay on this device and sync when you sign back in.`
            : undefined
        }
        actions={[{ label: 'Sign out', icon: 'logout', destructive: true, onPress: signOut }]}
        onClose={() => setConfirmSignOut(false)}
      />
    </>
  );
}

function MiniStat({ icon, value }: { icon: 'clock-outline' | 'weight-kilogram' | 'format-list-numbered'; value: string }) {
  const c = useColors();
  return (
    <View style={styles.mini}>
      <Icon name={icon} size={16} color={c.textMuted} />
      <Text variant="label" tone="textSecondary">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.huge, gap: space.lg },
  headerStack: { gap: space.lg, marginBottom: space.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.sm },
  section: { marginTop: space.sm },
  empty: { alignItems: 'center', gap: space.md, padding: space.xl, borderRadius: radius.card },
  center: { textAlign: 'center' },
  workout: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderCurve: 'continuous' },
  workoutHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statsRow: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  mini: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
