// Comments: one comment with its like button, the sheet that slides up from the bottom
// with every comment and a box to write one, and the swipeable preview under a feed card.
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ui/action-sheet';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useToggleCommentLike,
  type FeedComment,
} from '@/lib/social';
import { fonts, radius, size, space, useColors } from '@/theme';

import { Avatar } from './avatar';

/** Heart + count for a comment. */
function CommentLike({ c, onToggle, small }: { c: FeedComment; onToggle: () => void; small?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onToggle();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: c.liked }}
      accessibilityLabel={`${c.liked ? 'Unlike' : 'Like'} comment, ${c.like_count} ${c.like_count === 1 ? 'like' : 'likes'}`}
      style={styles.commentLike}>
      <Icon name={c.liked ? 'heart' : 'heart-outline'} size={small ? 16 : 18} color={c.liked ? colors.accent : colors.text} />
      <Text variant="caption" tone={c.liked ? 'accent' : 'textSecondary'} style={styles.likeCount}>
        {c.like_count > 0 ? c.like_count : ' '}
      </Text>
    </Pressable>
  );
}

export function CommentRow({
  c,
  workoutId,
  canDelete,
  onMenu,
}: {
  c: FeedComment;
  workoutId: string;
  canDelete: boolean;
  onMenu: (c: FeedComment) => void;
}) {
  const { session } = useSession();
  const like = useToggleCommentLike(workoutId);
  const mine = c.user_id === session?.user.id;
  return (
    <Pressable
      onLongPress={canDelete ? () => onMenu(c) : undefined}
      accessibilityHint={canDelete ? 'Long press for options' : undefined}
      style={styles.comment}>
      <Avatar name={c.username} size={32} />
      <View style={styles.flex}>
        <Text variant="label">
          <Text variant="label" style={{ fontFamily: fonts.semiBold }}>
            {mine ? 'You' : c.username}
          </Text>
          <Text variant="label" tone="textMuted">
            {'  '}
            {formatAgo(c.created_at)}
          </Text>
        </Text>
        <Text variant="body">{c.body}</Text>
      </View>
      <CommentLike c={c} onToggle={() => like.mutate({ commentId: c.id, like: !c.liked })} />
    </Pressable>
  );
}

/** Every comment on a workout, in a sheet over the current screen. The keyboard opens only when you tap the box. */
export function CommentsSheet({
  workoutId,
  ownerId,
  visible,
  onClose,
}: {
  workoutId: string;
  ownerId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const me = session?.user.id;
  const q = useComments(workoutId, visible);
  const add = useAddComment(workoutId);
  const remove = useDeleteComment(workoutId);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<FeedComment | null>(null);
  const send = () => {
    if (!draft.trim() || add.isPending) return;
    add.mutate(draft, { onSuccess: () => setDraft('') });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close comments" />
        <View style={[styles.sheet, { backgroundColor: c.surfaceRaised, paddingBottom: insets.bottom + space.sm }]}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <Text variant="headline" style={styles.sheetTitle} accessibilityRole="header">
            Comments
          </Text>
          <FlatList
            data={q.data ?? []}
            keyExtractor={(x) => x.id}
            style={styles.flex}
            contentContainerStyle={styles.sheetList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <CommentRow
                c={item}
                workoutId={workoutId}
                canDelete={item.user_id === me || ownerId === me}
                onMenu={setMenu}
              />
            )}
            ListEmptyComponent={
              <View style={styles.sheetEmpty}>
                {q.isPending ? (
                  <ActivityIndicator color={c.accent} />
                ) : q.isError ? (
                  <Text variant="body" tone="textSecondary">
                    Can&apos;t load comments. Check your connection.
                  </Text>
                ) : (
                  <>
                    <Text variant="headline">No comments yet</Text>
                    <Text variant="body" tone="textSecondary">
                      Start the conversation.
                    </Text>
                  </>
                )}
              </View>
            }
          />
          <View style={[styles.composer, { borderTopColor: c.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment"
              placeholderTextColor={c.textMuted}
              selectionColor={c.accent}
              cursorColor={c.accent}
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
            <Text variant="label" tone="danger" style={styles.center}>
              Couldn&apos;t post that. Check your connection.
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <ActionSheet
        visible={!!menu}
        actions={[
          { label: 'Delete comment', icon: 'trash-can-outline', destructive: true, onPress: () => menu && remove.mutate(menu.id) },
        ]}
        onClose={() => setMenu(null)}
      />
    </Modal>
  );
}

/**
 * One comment under a feed card; swipe sideways for the next. Newest first.
 * Tapping it (or "View all") opens the comments sheet.
 */
export function CommentPreview({
  workoutId,
  comments,
  total,
  onOpen,
}: {
  workoutId: string;
  comments: FeedComment[];
  total: number;
  onOpen: () => void;
}) {
  const c = useColors();
  const { session } = useSession();
  const like = useToggleCommentLike(workoutId);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  if (!comments.length) return null;

  return (
    <View style={styles.preview} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={comments.length > 1}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          accessibilityLabel={comments.length > 1 ? `Comments, ${page + 1} of ${comments.length}. Swipe for more` : 'Comment'}>
          {comments.map((cm) => (
            <View key={cm.id} style={[styles.previewPage, { width }]}>
              <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${cm.username}: ${cm.body}. Open comments`} style={styles.flex}>
                <Text variant="body" numberOfLines={2}>
                  <Text
                    variant="body"
                    style={{ fontFamily: fonts.semiBold }}
                    onPress={() => router.push({ pathname: '/user/[id]', params: { id: cm.user_id } })}>
                    {cm.user_id === session?.user.id ? 'You' : cm.username}
                  </Text>{' '}
                  {cm.body}
                </Text>
              </Pressable>
              <CommentLike c={cm} small onToggle={() => like.mutate({ commentId: cm.id, like: !cm.liked })} />
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.previewFoot}>
        <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button">
          <Text variant="label" tone="textMuted">
            {total === 1 ? 'View 1 comment' : `View all ${total} comments`}
          </Text>
        </Pressable>
        {comments.length > 1 ? (
          <View style={styles.dots}>
            {comments.map((cm, i) => (
              <View key={cm.id} style={[styles.dot, { backgroundColor: i === page ? c.text : c.border }]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  comment: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.sm },
  commentLike: { alignItems: 'center', minWidth: 28, paddingTop: 2 },
  likeCount: { fontSize: 11, lineHeight: 14 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    height: '75%',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: space.sm },
  sheetTitle: { textAlign: 'center', paddingVertical: space.sm },
  sheetList: { paddingHorizontal: space.lg, paddingBottom: space.md, flexGrow: 1 },
  sheetEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.huge },
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
  preview: { gap: space.xs },
  previewPage: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: size.touch - 8 },
  previewFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
