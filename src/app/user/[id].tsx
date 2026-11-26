// Someone's profile: who they are, whether they're working out right now, how you're
// connected, and (for friends and yourself) their stats, top lifts and workouts.
// Everything here comes from the server through RLS, so non-friends see no training data.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WeeklyCard } from '@/components/progress/weekly-card';
import { Avatar } from '@/components/social/avatar';
import { ExerciseList } from '@/components/social/exercise-history';
import { FeedCard } from '@/components/social/feed-card';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { formatDuration, formatNumber } from '@/lib/format';
import { weekStart, weekStreak, type WorkoutSummary } from '@/lib/progress';
import { useSession } from '@/lib/session';
import {
  useFeed,
  useFriendAction,
  useProfile,
  useProfileExercises,
  useProfileWorkouts,
  useToggleLike,
} from '@/lib/social';
import { useNow } from '@/lib/use-now';
import { radius, space, useColors } from '@/theme';

export default function UserScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const profile = useProfile(id);
  const p = profile.data;
  const canSee = p?.status === 'friends' || p?.status === 'self';
  const workouts = useProfileWorkouts(id, canSee);
  const exercises = useProfileExercises(id, canSee);
  const feed = useFeed(canSee ? id : undefined);
  const like = useToggleLike();
  const act = useFriendAction();
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const now = useNow(30_000);

  const stats = useMemo(() => {
    const list = workouts.data ?? [];
    const summaries: WorkoutSummary[] = list.map((w) => ({
      startedAt: w.started_at,
      volumeKg: w.volume_kg,
      durationS: (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000,
      sets: w.set_count,
    }));
    const thisWeek = weekStart(new Date()).getTime();
    return {
      summaries,
      total: list.length,
      streak: weekStreak(list.map((w) => w.started_at)),
      thisWeek: list.filter((w) => Date.parse(w.started_at) >= thisWeek).length,
      volume: list.reduce((t, w) => t + w.volume_kg, 0),
    };
  }, [workouts.data]);

  if (profile.isPending || profile.isError || !p) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScreenHeader />
        <View style={styles.center}>
          {profile.isPending ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <>
              <Text variant="body" tone="textSecondary" style={styles.centerText}>
                {profile.isError ? "Can't load this profile. Check your connection." : 'This person isn’t available.'}
              </Text>
              {profile.isError ? <Button label="Try again" onPress={() => profile.refetch()} /> : null}
            </>
          )}
        </View>
      </View>
    );
  }

  const busy = act.isPending;
  const items = feed.data?.pages.flat() ?? [];
  const activeFor = p.active_since ? (now - Date.parse(p.active_since)) / 1000 : 0;
  const refresh = () => {
    void profile.refetch();
    if (canSee) {
      void workouts.refetch();
      void exercises.refetch();
      void feed.refetch();
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        refreshControl={
          <RefreshControl refreshing={profile.isRefetching} onRefresh={refresh} tintColor={c.accent} colors={[c.accent]} />
        }>
        <View style={styles.head}>
          <View style={[styles.ring, { borderColor: p.active_since ? c.success : 'transparent' }]}>
            <Avatar name={p.username} size={84} />
          </View>
          <Text variant="display" accessibilityRole="header">
            {p.username}
          </Text>
          {p.display_name ? (
            <Text variant="body" tone="textSecondary">
              {p.display_name}
            </Text>
          ) : null}
          {p.status === 'friends' && p.since ? (
            <Text variant="label" tone="textMuted">
              Friends since {new Date(p.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </Text>
          ) : null}
        </View>

        {p.active_since ? (
          <View style={[styles.live, { backgroundColor: c.successBg }]} accessibilityLiveRegion="polite">
            <View style={[styles.liveDot, { backgroundColor: c.success }]} />
            <Text variant="headline" style={{ color: c.successText }}>
              {p.status === 'self' ? 'You’re working out now' : 'Working out now'} · {formatDuration(activeFor)}
            </Text>
          </View>
        ) : null}

        {p.status === 'none' ? (
          <Button label="Add friend" icon="account-plus" variant="primary" loading={busy}
            onPress={() => act.mutate({ action: 'request', otherId: p.id })} />
        ) : p.status === 'sent' ? (
          <Button label="Cancel request" icon="account-clock-outline" loading={busy}
            onPress={() => act.mutate({ action: 'remove', otherId: p.id })} />
        ) : p.status === 'received' ? (
          <View style={styles.pair}>
            <Button label="Decline" style={styles.flex} disabled={busy}
              onPress={() => act.mutate({ action: 'remove', otherId: p.id })} />
            <Button label="Accept" variant="primary" style={styles.flex} loading={busy}
              onPress={() => act.mutate({ action: 'accept', otherId: p.id })} />
          </View>
        ) : p.status === 'friends' ? (
          <Button label="Friends" icon="account-check" onPress={() => setMenu(true)} />
        ) : null}
        {act.isError ? (
          <Text variant="label" tone="danger" style={styles.centerText}>
            That didn&apos;t work. Check your connection and try again.
          </Text>
        ) : null}

        {!canSee ? (
          <View style={[styles.card, styles.locked, { backgroundColor: c.surface }]}>
            <Icon name="lock-outline" size={28} color={c.textMuted} />
            <Text variant="body" tone="textSecondary" style={styles.centerText}>
              {p.status === 'received'
                ? `Accept ${p.username}'s request to see their workouts and stats.`
                : `Once you're friends, you'll see ${p.username}'s workouts and stats here.`}
            </Text>
          </View>
        ) : workouts.isPending ? (
          <ActivityIndicator color={c.accent} style={styles.pad} />
        ) : workouts.isError ? (
          <Text variant="body" tone="textSecondary" style={styles.centerText}>
            Can&apos;t load their stats. Check your connection.
          </Text>
        ) : (
          <>
            <View style={styles.tiles}>
              <Tile icon="dumbbell" label="Workouts" value={formatNumber(stats.total)} />
              <Tile icon="fire" label="Week streak" value={String(stats.streak)} />
              <Tile icon="calendar-week" label="This week" value={String(stats.thisWeek)} />
              <Tile icon="weight-kilogram" label="Total volume" value={`${compactKg(stats.volume)}`} />
            </View>

            {stats.total ? <WeeklyCard workouts={stats.summaries} /> : null}

            {exercises.data?.length ? (
              <View style={[styles.card, styles.exCard, { backgroundColor: c.surface }]}>
                {/* The header opens every exercise they've done. */}
                <Pressable
                  onPress={() => router.push({ pathname: '/user/exercises/[id]', params: { id: p.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Top exercises. See all of ${p.status === 'self' ? 'your' : `${p.username}'s`} exercises`}
                  style={({ pressed }) => [styles.exHead, { opacity: pressed ? 0.7 : 1 }]}>
                  <Text variant="caption" tone="textMuted" style={styles.flex}>
                    TOP EXERCISES
                  </Text>
                  <Text variant="label" tone="accent">
                    See all
                  </Text>
                  <Icon name="chevron-right" size={20} color={c.accent} />
                </Pressable>
                <ExerciseList userId={p.id} exercises={exercises.data} />
              </View>
            ) : null}

            <Text variant="caption" tone="textMuted" accessibilityRole="header">
              {stats.total ? 'WORKOUTS' : 'NO WORKOUTS YET'}
            </Text>
            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                mine={item.owner_id === session?.user.id}
                onLike={(v) => like.mutate({ workoutId: item.id, like: v })}
              />
            ))}
            {feed.hasNextPage ? (
              <Button label="Show more" loading={feed.isFetchingNextPage} onPress={() => feed.fetchNextPage()} />
            ) : null}
          </>
        )}
      </ScrollView>

      <ActionSheet
        visible={menu}
        title={p.username}
        actions={[
          { label: 'Unfriend', icon: 'account-remove-outline', onPress: () => act.mutate({ action: 'remove', otherId: p.id }) },
          { label: 'Block', icon: 'cancel', destructive: true, onPress: () => setConfirmBlock(true) },
        ]}
        onClose={() => setMenu(false)}
      />
      <ActionSheet
        visible={confirmBlock}
        title={`Block ${p.username}?`}
        message="You'll stop being friends, and neither of you will find the other in search."
        actions={[
          {
            label: 'Block',
            icon: 'cancel',
            destructive: true,
            onPress: () => act.mutate({ action: 'block', otherId: p.id }, { onSuccess: () => router.back() }),
          },
        ]}
        onClose={() => setConfirmBlock(false)}
      />
    </View>
  );
}

const compactKg = (kg: number) =>
  kg >= 1_000_000 ? `${Math.round(kg / 100_000) / 10}M kg` : kg >= 10_000 ? `${Math.round(kg / 100) / 10}K kg` : `${formatNumber(Math.round(kg))} kg`;

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const c = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: c.surface }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={20} color={c.accent} />
      <Text variant="numeric">{value}</Text>
      <Text variant="caption" tone="textMuted">
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.lg },
  centerText: { textAlign: 'center' },
  pad: { margin: space.xl },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 600, alignSelf: 'center' },
  head: { alignItems: 'center', gap: space.xs },
  ring: { padding: 3, borderRadius: 50, borderWidth: 3, marginBottom: space.sm },
  live: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.md, borderRadius: radius.card },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  pair: { flexDirection: 'row', gap: space.sm },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  locked: { alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.card, padding: space.md, gap: 2 },
  exCard: { gap: 0, paddingBottom: space.sm },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, marginTop: -space.sm },
});
