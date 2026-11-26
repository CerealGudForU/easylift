// Feed: your and your friends' finished workouts, newest first, 10 at a time.
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedCard } from '@/components/social/feed-card';
import { FriendsRow } from '@/components/social/friends-row';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/lib/session';
import { useFeed, useFriends, useFriendsNow, useToggleLike, useUnreadCount } from '@/lib/social';
import { size, space, useColors } from '@/theme';

export default function FeedScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const feed = useFeed();
  const friends = useFriends();
  const friendsNow = useFriendsNow();
  const unread = useUnreadCount();
  const like = useToggleLike();
  const items = feed.data?.pages.flat() ?? [];
  const requests = friends.data?.filter((f) => f.status === 'received').length ?? 0;
  const hasFriends = friends.data?.some((f) => f.status === 'friends') ?? false;

  // Coming back to the tab (e.g. after finishing a workout) picks up anything new.
  const { refetch } = feed;
  const { refetch: refetchFriendsNow } = friendsNow;
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchFriendsNow();
    }, [refetch, refetchFriendsNow]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Text variant="title" style={styles.flex} accessibilityRole="header">
          Feed
        </Text>
        <HeaderButton
          icon="account-plus-outline"
          label={requests ? `Friends, ${requests} new requests` : 'Friends'}
          badge={requests}
          onPress={() => router.push('/friends')}
        />
        <HeaderButton
          icon="bell-outline"
          label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          badge={unread}
          onPress={() => router.push('/notifications')}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={[styles.list, items.length === 0 && styles.grow]}
        ListHeaderComponent={
          friendsNow.data?.length ? <FriendsRow friends={friendsNow.data} /> : undefined
        }
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            mine={item.owner_id === session?.user.id}
            onLike={(v) => like.mutate({ workoutId: item.id, like: v })}
          />
        )}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => {
              feed.refetch();
              friends.refetch();
              friendsNow.refetch();
            }}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? <ActivityIndicator color={c.accent} style={styles.footer} /> : undefined
        }
        ListEmptyComponent={
          feed.isPending ? (
            <ActivityIndicator color={c.accent} style={styles.footer} />
          ) : feed.isError ? (
            <Empty
              icon="cloud-off-outline"
              headline="Can't load the feed"
              body="The feed needs a connection. Your own workouts still save offline."
              action={{ label: 'Try again', onPress: () => feed.refetch() }}
            />
          ) : hasFriends ? (
            <Empty
              icon="dumbbell"
              headline="Nothing here yet"
              body="When you or your friends finish a workout, it shows up here."
            />
          ) : (
            <Empty
              icon="account-group-outline"
              headline="Lift with your friends"
              body="Add friends by username to see their workouts here."
              action={{ label: 'Add friends', onPress: () => router.push('/friends') }}
            />
          )
        }
      />
    </View>
  );
}

function HeaderButton({ icon, label, badge, onPress }: { icon: IconName; label: string; badge: number; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={26} color={c.textSecondary} />
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.bg }]}>
          <Text variant="caption" style={{ color: c.onAccent, fontSize: 11, lineHeight: 14 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Empty({
  icon,
  headline,
  body,
  action,
}: {
  icon: IconName;
  headline: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyBadge, { backgroundColor: c.field }]}>
        <Icon name={icon} size={32} color={c.accent} />
      </View>
      <Text variant="headline" style={styles.center}>
        {headline}
      </Text>
      <Text variant="body" tone="textSecondary" style={styles.center}>
        {body}
      </Text>
      {action ? <Button label={action.label} variant="primary" onPress={action.onPress} style={styles.cta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.lg, minHeight: size.touch },
  flex: { flex: 1 },
  list: { padding: space.lg, gap: space.lg },
  grow: { flexGrow: 1 },
  footer: { marginVertical: space.xl },
  headerButton: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingBottom: space.huge },
  emptyBadge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center', maxWidth: 300 },
  cta: { marginTop: space.sm, alignSelf: 'stretch' },
});
