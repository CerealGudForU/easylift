// The row of friends on top of the feed. Working out now = a green ring and a
// "LIFTING" tag, and they're listed first. Tap someone to see their profile.
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration } from '@/lib/format';
import type { FriendNow } from '@/lib/social';
import { useNow } from '@/lib/use-now';
import { space, useColors } from '@/theme';

import { Avatar } from './avatar';

const SIZE = 64;

export function FriendsRow({ friends }: { friends: FriendNow[] }) {
  const c = useColors();
  const now = useNow(60_000);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Friends"
      style={styles.scroll}>
      <Pressable
        onPress={() => router.push('/friends')}
        accessibilityRole="button"
        accessibilityLabel="Add friends"
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.ring, { borderColor: c.border, borderStyle: 'dashed' }]}>
          <View style={[styles.add, { backgroundColor: c.field }]}>
            <Icon name="plus" size={28} color={c.accent} />
          </View>
        </View>
        <Text variant="caption" tone="textSecondary" numberOfLines={1} style={styles.name}>
          Add
        </Text>
      </Pressable>
      {friends.map((f) => {
        const active = !!f.active_since;
        const forS = active ? (now - Date.parse(f.active_since!)) / 1000 : 0;
        return (
          <Pressable
            key={f.id}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${f.username}${active ? `, working out now, for ${formatDuration(forS)}` : ''}. Open profile`}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.ring, { borderColor: active ? c.success : 'transparent' }]}>
              <Avatar name={f.username} size={SIZE - 10} />
              {active ? (
                <View style={[styles.tag, { backgroundColor: c.success, borderColor: c.bg }]}>
                  <Text variant="caption" style={[styles.tagText, { color: c.onSuccess }]}>
                    LIFTING
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" tone={active ? 'text' : 'textSecondary'} numberOfLines={1} style={styles.name}>
              {f.username}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginHorizontal: -space.lg },
  row: { gap: space.md, paddingHorizontal: space.lg },
  item: { width: SIZE + 8, alignItems: 'center', gap: space.xs },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { width: SIZE - 10, height: SIZE - 10, borderRadius: (SIZE - 10) / 2, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', bottom: -8, paddingHorizontal: 5, borderRadius: 6, borderWidth: 2 },
  tagText: { fontSize: 9, lineHeight: 12, letterSpacing: 0.6 },
  name: { maxWidth: SIZE + 8, textAlign: 'center', marginTop: 4 },
});
