// Notifications: friend requests, accepted requests, likes and comments.
// Opening the screen marks everything as read.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/social/avatar';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { formatAgo } from '@/lib/format';
import { markNotificationsRead, useNotifications, type AppNotification } from '@/lib/social';
import { space, useColors } from '@/theme';

const ICON: Record<AppNotification['kind'], IconName> = {
  friend_request: 'account-plus',
  friend_accepted: 'account-check',
  like: 'heart',
  comment: 'comment',
};

function describe(n: AppNotification): string {
  const title = n.workout?.title ? ` "${n.workout.title}"` : ' your workout';
  switch (n.kind) {
    case 'friend_request':
      return 'sent you a friend request';
    case 'friend_accepted':
      return 'accepted your friend request';
    case 'like':
      return `liked${title}`;
    case 'comment':
      return `commented on${title}`;
  }
}

export default function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const q = useNotifications();

  // Mark read once the list has loaded, so the unread dots show for this visit.
  const loaded = q.isSuccess;
  useEffect(() => {
    if (loaded) void markNotificationsRead();
  }, [loaded]);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Notifications" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.accent} colors={[c.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {q.isPending ? (
              <ActivityIndicator color={c.accent} />
            ) : q.isError ? (
              <>
                <Text variant="body" tone="textSecondary" style={styles.center}>
                  Can&apos;t load notifications. Check your connection.
                </Text>
                <Button label="Try again" onPress={() => q.refetch()} />
              </>
            ) : (
              <Text variant="body" tone="textSecondary" style={styles.center}>
                Friend requests, likes and comments show up here.
              </Text>
            )}
          </View>
        }
        renderItem={({ item: n }) => {
          const who = n.actor?.username ?? 'Someone';
          const unread = !n.read_at;
          const open = () =>
            n.workout_id ? router.push({ pathname: '/post/[id]', params: { id: n.workout_id } }) : router.push('/friends');
          return (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`${unread ? 'New. ' : ''}${who} ${describe(n)}, ${formatAgo(n.created_at)}`}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surface : 'transparent' }]}>
              <View>
                <Avatar name={who} size={44} />
                <View style={[styles.kind, { backgroundColor: c.accent, borderColor: c.bg }]}>
                  <Icon name={ICON[n.kind]} size={12} color={c.onAccent} />
                </View>
              </View>
              <Text variant="body" style={styles.flex}>
                <Text variant="headline">{who}</Text> {describe(n)}
                <Text variant="label" tone="textMuted">
                  {'  '}
                  {formatAgo(n.created_at)}
                </Text>
              </Text>
              {unread ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  kind: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  center: { textAlign: 'center' },
});
