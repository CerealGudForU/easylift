// One workout in the feed: who and when, title with duration, photos, headline stats,
// the first exercises, like / comment buttons, and one comment (swipe for more).
// Tapping the card opens the full workout; Comment opens the comments sheet.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDuration, formatNumber, formatPosted } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import type { FeedItem } from '@/lib/social';
import { radius, size, space, useColors } from '@/theme';

import { Avatar } from './avatar';
import { CommentPreview, CommentsSheet } from './comments';
import { PhotoCarousel } from './workout-photo';

type Props = { item: FeedItem; mine: boolean; onLike: (like: boolean) => void };

export function FeedCard({ item, mine, onLike }: Props) {
  const c = useColors();
  const [sheet, setSheet] = useState(false);
  const durationS = (new Date(item.ended_at).getTime() - new Date(item.started_at).getTime()) / 1000;
  const more = item.exercise_count - item.top_exercises.length;
  const open = () => router.push({ pathname: '/post/[id]', params: { id: item.id } });

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      {/* Who and when: opens their profile. Kept outside the card's own press area
          (a button inside a button is invalid on web). */}
      <Pressable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.owner_id } })}
        accessibilityRole="button"
        accessibilityLabel={`${mine ? 'Your' : `${item.username}'s`} profile. Posted ${formatPosted(item.ended_at)}`}
        style={({ pressed }) => [styles.who, { opacity: pressed ? 0.7 : 1 }]}>
        <Avatar name={item.username} />
        <View style={styles.flex}>
          <Text variant="headline" numberOfLines={1}>
            {mine ? 'You' : item.username}
          </Text>
          <Text variant="label" tone="textMuted" numberOfLines={1}>
            {formatPosted(item.ended_at)}
          </Text>
        </View>
      </Pressable>
      {/* Title, photos and stats. The photos sit outside the tap-to-open areas so a
          sideways swipe is never mistaken for a tap on the card. */}
      <View style={styles.body}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${mine ? 'Your' : `${item.username}'s`} workout: ${item.title}, ${formatDuration(durationS)}. Open workout`}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <View style={styles.titleRow}>
          <Text variant="title" numberOfLines={2} style={styles.flex}>
            {item.title}
          </Text>
          <View style={styles.duration}>
            <Icon name="clock-outline" size={16} color={c.textSecondary} />
            <Text variant="stat" tone="textSecondary">
              {formatDuration(durationS)}
            </Text>
          </View>
        </View>
      </Pressable>

        {item.photos.length ? <PhotoCarousel photos={item.photos} label={`Photos from ${item.title}`} /> : null}

      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${item.exercise_count} exercises, ${item.set_count} sets. Open workout`}
        style={({ pressed }) => [styles.details, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={styles.stats}>
          <Stat label="Exercises" value={String(item.exercise_count)} />
          <Stat label="Sets" value={String(item.set_count)} />
          <Stat label="Volume" value={`${formatNumber(Math.round(item.volume_kg))} kg`} />
        </View>

        {item.top_exercises.length ? (
          <View style={[styles.exercises, { borderTopColor: c.border }]}>
            {item.top_exercises.map((x, i) => (
              <Text key={i} variant="body" numberOfLines={1}>
                <Text variant="body" tone="textMuted">
                  {x.sets} ×{' '}
                </Text>
                {x.name}
              </Text>
            ))}
            {more > 0 ? (
              <Text variant="label" tone="textMuted">
                +{more} more {more === 1 ? 'exercise' : 'exercises'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      </View>

      <View style={[styles.actions, { borderTopColor: c.border }]}>
        <Pressable
          onPress={() => {
            haptic.select();
            onLike(!item.liked);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: item.liked }}
          accessibilityLabel={`${item.liked ? 'Unlike' : 'Like'}, ${item.like_count} ${item.like_count === 1 ? 'like' : 'likes'}`}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <Icon name={item.liked ? 'heart' : 'heart-outline'} size={26} color={item.liked ? c.accent : c.text} />
          {item.like_count ? (
            <Text variant="headline" tone={item.liked ? 'accent' : 'text'}>
              {countLabel(item.like_count)}
            </Text>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => setSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={`Comments, ${item.comment_count}`}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <Icon name="comment-outline" size={26} color={c.text} />
          {item.comment_count ? (
            <Text variant="headline" tone="text">
              {countLabel(item.comment_count)}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {item.comments.length ? (
        <View style={styles.previewWrap}>
          <CommentPreview
            workoutId={item.id}
            comments={item.comments}
            total={item.comment_count}
            onOpen={() => setSheet(true)}
          />
        </View>
      ) : null}

      <CommentsSheet workoutId={item.id} ownerId={item.owner_id} visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

/** 950 → "950", 1234 → "1.2K", 17400 → "17.4K", 2000000 → "2M". */
function countLabel(n: number): string {
  const short = (v: number, unit: string) => `${Math.floor(v * 10) / 10}`.replace(/\.0$/, '') + unit;
  if (n >= 1_000_000) return short(n / 1_000_000, 'M');
  if (n >= 1_000) return short(n / 1_000, 'K');
  return String(n);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" tone="textMuted">
        {label.toUpperCase()}
      </Text>
      <Text variant="stat">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', width: '100%', maxWidth: 560, alignSelf: 'center' },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg },
  flex: { flex: 1 },
  details: { gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  duration: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xxl, rowGap: space.sm },
  stat: { gap: 2 },
  exercises: { gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  // Instagram-style: icons on the left with their counts beside them.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: size.touch,
    minWidth: size.touch,
    paddingHorizontal: space.xs,
  },
  previewWrap: { paddingHorizontal: space.lg, paddingBottom: space.md },
});
