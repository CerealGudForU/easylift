// A workout as friends see it (from the server): stats, every set, likes and comments.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/social/avatar';
import { CommentRow } from '@/components/social/comments';
import { PhotoCarousel } from '@/components/social/workout-photo';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { setLabels } from '@/components/workout/types';
import { equipmentLabel } from '@/lib/exercise-labels';
import { formatDuration, formatNumber, formatWorkoutDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { useAddComment, useComments, useDeleteComment, usePost, useToggleLike, type FeedComment } from '@/lib/social';
import { fonts, radius, size, space, useColors } from '@/theme';

export default function PostScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id, comment: focusComment } = useLocalSearchParams<{ id: string; comment?: string }>();
  const { session } = useSession();
  const me = session?.user.id;
  const post = usePost(id);
  const like = useToggleLike();
  const add = useAddComment(id);
  const remove = useDeleteComment(id);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<FeedComment | null>(null);
  // Comments with their likes (the post query's own list has no likes).
  const comments = useComments(id).data ?? [];

  if (post.isPending || post.isError || !post.data) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <ScreenHeader />
        <View style={styles.center}>
          {post.isPending ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <>
              <Text variant="body" tone="textSecondary" style={styles.centerText}>
                {post.isError ? "Can't load this workout. Check your connection." : 'This workout is no longer available.'}
              </Text>
              {post.isError ? <Button label="Try again" onPress={() => post.refetch()} /> : null}
            </>
          )}
        </View>
      </View>
    );
  }

  const p = post.data;
  const mine = p.owner_id === me;
  const liked = p.likes.some((l) => l.user_id === me);
  const owner = p.owner?.username ?? 'Someone';
  const sets = p.exercises.flatMap((x) => x.sets);
  const volume = sets.filter((s) => s.set_type !== 'warmup').reduce((t, s) => t + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
  const durationS = p.ended_at ? (new Date(p.ended_at).getTime() - new Date(p.started_at).getTime()) / 1000 : 0;
  const likers = p.likes.map((l) => (l.user_id === me ? 'You' : l.user?.username)).filter(Boolean) as string[];
  const send = () => {
    if (!draft.trim() || add.isPending) return;
    add.mutate(draft, { onSuccess: () => setDraft('') });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.who}>
          <Avatar name={owner} size={44} />
          <View style={styles.flex}>
            <Text variant="headline">{mine ? 'You' : owner}</Text>
            <Text variant="label" tone="textMuted">
              {formatWorkoutDate(p.started_at)}
            </Text>
          </View>
          {mine ? (
            <Button label="Share" icon="share-variant" compact onPress={() => router.push({ pathname: '/share/[id]', params: { id } })} />
          ) : null}
        </View>
        <Text variant="title">{p.title}</Text>
        {p.photos.length ? <PhotoCarousel photos={p.photos} label={`Photos from ${p.title}`} /> : null}

        <View style={[styles.stats, { backgroundColor: c.surface }]}>
          <Stat label="Duration" value={formatDuration(durationS)} />
          <Stat label="Volume" value={`${formatNumber(Math.round(volume))} kg`} />
          <Stat label="Sets" value={String(sets.length)} />
        </View>

        {p.exercises.map((x) => {
          const labels = setLabels(
            x.sets.map((s) => ({ id: s.id, type: s.set_type as never, weightKg: null, reps: null, done: true })),
          );
          return (
            <View key={x.id} style={[styles.card, { backgroundColor: c.surface }]}>
              <Text variant="exercise" tone="accent" numberOfLines={2}>
                {x.name}
              </Text>
              <Text variant="label" tone="textMuted">
                {equipmentLabel(x.equipment)}
              </Text>
              {x.sets.map((s, i) => (
                <View key={s.id} style={styles.setRow}>
                  <Text variant="numeric" tone="textSecondary" style={styles.setLabel}>
                    {labels[i]}
                  </Text>
                  <Text variant="numeric">
                    {s.weight_kg ? `${formatNumber(s.weight_kg)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.likeRow}>
          <Pressable
            onPress={() => {
              haptic.select();
              like.mutate({ workoutId: id, like: !liked });
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            style={({ pressed }) => [styles.likeButton, { backgroundColor: c.field, opacity: pressed ? 0.7 : 1 }]}>
            <Icon name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? c.accent : c.textSecondary} />
          </Pressable>
          <Text variant="label" tone="textSecondary" style={styles.flex}>
            {likers.length === 0
              ? 'No likes yet'
              : likers.length <= 2
                ? `Liked by ${likers.join(' and ')}`
                : `Liked by ${likers.slice(0, 2).join(', ')} and ${likers.length - 2} more`}
          </Text>
        </View>

        <Text variant="caption" tone="textMuted" accessibilityRole="header">
          {comments.length ? `COMMENTS · ${comments.length}` : 'COMMENTS'}
        </Text>
        {comments.length === 0 ? (
          <Text variant="body" tone="textSecondary">
            {mine ? 'No comments yet.' : `Say something nice to ${owner}.`}
          </Text>
        ) : (
          comments.map((cm) => (
            <CommentRow key={cm.id} c={cm} workoutId={id} canDelete={cm.user_id === me || mine} onMenu={setMenu} />
          ))
        )}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: c.border, paddingBottom: insets.bottom + space.sm, backgroundColor: c.bg }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment"
          placeholderTextColor={c.textMuted}
          selectionColor={c.accent}
          cursorColor={c.accent}
          autoFocus={focusComment === '1'}
          multiline
          maxLength={500}
          accessibilityLabel="Add a comment"
          style={[styles.input, { color: c.text, backgroundColor: c.field }]}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || add.isPending}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          accessibilityState={{ disabled: !draft.trim() || add.isPending }}
          style={[styles.send, { backgroundColor: draft.trim() ? c.accent : c.field }]}>
          {add.isPending ? (
            <ActivityIndicator size="small" color={c.onAccent} />
          ) : (
            <Icon name="send" size={20} color={draft.trim() ? c.onAccent : c.textMuted} />
          )}
        </Pressable>
      </View>
      {add.isError ? (
        <Text variant="label" tone="danger" style={styles.sendError}>
          Couldn&apos;t post that. Check your connection.
        </Text>
      ) : null}

      <ActionSheet
        visible={!!menu}
        actions={[
          { label: 'Delete comment', icon: 'trash-can-outline', destructive: true, onPress: () => menu && remove.mutate(menu.id) },
        ]}
        onClose={() => setMenu(null)}
      />
    </KeyboardAvoidingView>
  );
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
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.lg },
  centerText: { textAlign: 'center' },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stats: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: radius.card, paddingVertical: space.lg },
  stat: { alignItems: 'center', gap: 2 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.xs },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  setLabel: { width: 28, fontSize: 18, textAlign: 'center' },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  likeButton: { width: size.touch, height: size.touch, borderRadius: size.touch / 2, alignItems: 'center', justifyContent: 'center' },
  comment: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 16,
    outlineWidth: 0,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendError: { textAlign: 'center', paddingBottom: space.sm },
});
