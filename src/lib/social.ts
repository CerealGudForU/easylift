// Friends, feed, likes, comments and notifications. All server-only (online), read
// through TanStack Query. Who can see what is decided by RLS on the server
// (supabase/migrations, tested in supabase/tests/rls.sql), never here.
import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Photo } from './photos';
import { queryClient } from './query';
import { useSession } from './session';
import { supabase } from './supabase';

const PAGE = 10;

// --- Types ------------------------------------------------------------------------

export type FeedItem = {
  id: string;
  owner_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  title: string;
  started_at: string;
  ended_at: string;
  exercise_count: number;
  set_count: number;
  volume_kg: number;
  top_exercises: { name: string; sets: number }[];
  like_count: number;
  comment_count: number;
  liked: boolean;
  photos: Photo[];
  /** Up to 10 most recent comments, newest first (the preview under the card). */
  comments: FeedComment[];
};

export type FeedComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  username: string;
  like_count: number;
  liked: boolean;
};

export type FriendStatus = 'none' | 'friends' | 'sent' | 'received';
export type Person = { id: string; username: string; display_name: string | null; avatar_url: string | null };
export type SearchResult = Person & { status: FriendStatus };
export type Friend = Person & { status: Exclude<FriendStatus, 'none'>; since: string };

export type Comment = { id: string; body: string; created_at: string; user_id: string; user: Person | null };
export type PostSet = { id: string; position: number; set_type: string; weight_kg: number | null; reps: number | null };
export type PostExercise = { id: string; name: string; equipment: string | null; sets: PostSet[] };
export type Post = {
  id: string;
  owner_id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  photos: Photo[];
  owner: Person | null;
  exercises: PostExercise[];
  likes: { user_id: string; user: Person | null }[];
};

export type NotificationKind = 'friend_request' | 'friend_accepted' | 'like' | 'comment';
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  workout_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: Person | null;
  workout: { title: string } | null;
};

const keys = {
  feed: ['feed'] as const,
  post: (id: string) => ['post', id] as const,
  friends: ['friends'] as const,
  search: (q: string) => ['search', q] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
};

/** Throws the PostgREST error, so queries and mutations see it as a failure. */
function must<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

// --- Feed -------------------------------------------------------------------------

type Cursor = { started: string; id: string } | null;

/** The feed, or with `owner` just that person's workouts (their profile). */
export function useFeed(owner?: string) {
  return useInfiniteQuery({
    queryKey: owner ? ([...keys.feed, owner] as const) : keys.feed,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const rows = must(
        await supabase.rpc('get_feed', {
          before_started: pageParam?.started ?? null,
          before_id: pageParam?.id ?? null,
          page_size: PAGE,
          only_owner: owner ?? null,
        } as never),
      ) as FeedItem[];
      return rows.map((r) => ({ ...r, volume_kg: Number(r.volume_kg) }));
    },
    getNextPageParam: (last): Cursor => {
      if (last.length < PAGE) return null;
      const tail = last[last.length - 1];
      return { started: tail.started_at, id: tail.id };
    },
  });
}

/** Patches one workout everywhere it's cached (feed pages), e.g. for an optimistic like. */
function patchFeedItem(id: string, patch: (x: FeedItem) => FeedItem) {
  queryClient.setQueriesData<InfiniteData<FeedItem[], Cursor>>({ queryKey: keys.feed }, (d) =>
    d ? { ...d, pages: d.pages.map((p) => p.map((x) => (x.id === id ? patch(x) : x))) } : d,
  );
}

// --- Likes ------------------------------------------------------------------------

/** Like or unlike. Updates the screen straight away and rolls back if the server says no. */
export function useToggleLike() {
  const { session } = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async ({ workoutId, like }: { workoutId: string; like: boolean }) => {
      if (like) must(await supabase.from('likes').insert({ workout_id: workoutId } as never));
      else must(await supabase.from('likes').delete().eq('workout_id', workoutId).eq('user_id', uid!));
    },
    onMutate: ({ workoutId, like }) => {
      const flip = (x: FeedItem) => ({ ...x, liked: like, like_count: Math.max(0, x.like_count + (like ? 1 : -1)) });
      patchFeedItem(workoutId, flip);
      queryClient.setQueryData<Post>(keys.post(workoutId), (p) =>
        p && uid
          ? {
              ...p,
              likes: like
                ? [...p.likes.filter((l) => l.user_id !== uid), { user_id: uid, user: null }]
                : p.likes.filter((l) => l.user_id !== uid),
            }
          : p,
      );
    },
    onError: (_e, { workoutId, like }) => {
      patchFeedItem(workoutId, (x) => ({ ...x, liked: !like, like_count: Math.max(0, x.like_count + (like ? -1 : 1)) }));
      queryClient.invalidateQueries({ queryKey: keys.post(workoutId) });
    },
    onSettled: (_d, _e, { workoutId }) => queryClient.invalidateQueries({ queryKey: keys.post(workoutId) }),
  });
}

// --- One workout (post) -----------------------------------------------------------

export function usePost(id: string) {
  return useQuery({
    queryKey: keys.post(id),
    queryFn: async (): Promise<Post | null> => {
      // Comments load separately (useComments), with their likes.
      const [w, ex, likes, photos] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, owner_id, title, started_at, ended_at, owner:profiles!workouts_owner_id_fkey(id, username, display_name, avatar_url)')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('workout_exercises')
          .select('id, position, exercise:exercises(name, equipment), sets:workout_sets(id, position, set_type, weight_kg, reps, completed_at, deleted_at)')
          .eq('workout_id', id)
          .is('deleted_at', null)
          .order('position'),
        supabase.from('likes').select('user_id, user:profiles(id, username, display_name, avatar_url)').eq('workout_id', id),
        supabase
          .from('workout_photos')
          .select('id, path, width, height, crop_x, crop_y, crop_w, crop_h')
          .eq('workout_id', id)
          .order('position')
          .order('created_at'),
      ]);
      const workout = must(w) as unknown as Omit<Post, 'exercises' | 'likes' | 'photos'> | null;
      if (!workout) return null;
      type RawEx = {
        id: string;
        exercise: { name: string; equipment: string | null } | null;
        sets: (PostSet & { completed_at: string | null; deleted_at: string | null })[];
      };
      return {
        ...workout,
        exercises: (must(ex) as unknown as RawEx[]).map((x) => ({
          id: x.id,
          name: x.exercise?.name ?? 'Exercise',
          equipment: x.exercise?.equipment ?? null,
          sets: x.sets.filter((s) => s.completed_at && !s.deleted_at).sort((a, b) => a.position - b.position),
        })),
        likes: must(likes) as unknown as Post['likes'],
        photos: must(photos) as unknown as Photo[],
      };
    },
  });
}

/** A workout's comments, oldest first, with likes. */
export function useComments(workoutId: string, enabled = true) {
  return useQuery({
    queryKey: ['comments', workoutId],
    enabled,
    queryFn: async () => must(await supabase.rpc('get_comments', { wid: workoutId } as never)) as FeedComment[],
  });
}

function refreshComments(workoutId: string) {
  void queryClient.invalidateQueries({ queryKey: ['comments', workoutId] });
  void queryClient.invalidateQueries({ queryKey: keys.post(workoutId) });
  void queryClient.invalidateQueries({ queryKey: keys.feed });
}

/** Like or unlike a comment; updates every place it shows straight away. */
export function useToggleCommentLike(workoutId: string) {
  const { session } = useSession();
  const uid = session?.user.id;
  const flip = (like: boolean, commentId: string) => (c: FeedComment) =>
    c.id === commentId ? { ...c, liked: like, like_count: Math.max(0, c.like_count + (like ? 1 : -1)) } : c;
  const apply = (commentId: string, like: boolean) => {
    const f = flip(like, commentId);
    queryClient.setQueryData<FeedComment[]>(['comments', workoutId], (d) => d?.map(f));
    patchFeedItem(workoutId, (x) => ({ ...x, comments: x.comments.map(f) }));
  };
  return useMutation({
    mutationFn: async ({ commentId, like }: { commentId: string; like: boolean }) => {
      if (like) must(await supabase.from('comment_likes').insert({ comment_id: commentId } as never));
      else must(await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', uid!));
    },
    onMutate: ({ commentId, like }) => apply(commentId, like),
    onError: (_e, { commentId, like }) => apply(commentId, !like),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['comments', workoutId] }),
  });
}

export function useAddComment(workoutId: string) {
  return useMutation({
    mutationFn: async (body: string) =>
      must(await supabase.from('comments').insert({ workout_id: workoutId, body: body.trim() } as never)),
    onSuccess: () => {
      patchFeedItem(workoutId, (x) => ({ ...x, comment_count: x.comment_count + 1 }));
      refreshComments(workoutId);
    },
  });
}

export function useDeleteComment(workoutId: string) {
  return useMutation({
    mutationFn: async (commentId: string) => must(await supabase.from('comments').delete().eq('id', commentId)),
    onSuccess: () => {
      patchFeedItem(workoutId, (x) => ({ ...x, comment_count: Math.max(0, x.comment_count - 1) }));
      refreshComments(workoutId);
    },
  });
}

// --- Friends ----------------------------------------------------------------------

export function useFriends() {
  return useQuery({
    queryKey: keys.friends,
    queryFn: async () => must(await supabase.rpc('list_friends')) as Friend[],
  });
}

export function useSearchPeople(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: keys.search(term.toLowerCase()),
    enabled: term.length >= 2,
    queryFn: async () => must(await supabase.rpc('search_profiles', { q: term } as never)) as SearchResult[],
  });
}

type FriendAction = 'request' | 'accept' | 'remove' | 'block';

/** Send / accept a request, or remove one (decline, cancel, unfriend), or block someone. */
export function useFriendAction() {
  const { session } = useSession();
  const me = session?.user.id;
  return useMutation({
    mutationFn: async ({ action, otherId }: { action: FriendAction; otherId: string }) => {
      if (!me) throw new Error('Signed out');
      const pair = { user_a: me < otherId ? me : otherId, user_b: me < otherId ? otherId : me };
      if (action === 'request') must(await supabase.from('friendships').insert(pair as never));
      if (action === 'accept')
        must(await supabase.from('friendships').update({ status: 'accepted' } as never).match(pair));
      if (action === 'remove') must(await supabase.from('friendships').delete().match(pair));
      if (action === 'block') must(await supabase.from('blocks').insert({ blocked_id: otherId } as never));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.friends }),
        queryClient.invalidateQueries({ queryKey: ['search'] }),
        queryClient.invalidateQueries({ queryKey: keys.feed }),
        queryClient.invalidateQueries({ queryKey: ['friends-now'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]),
  });
}

// --- Friends row and profiles -----------------------------------------------------

export type FriendNow = Person & { active_since: string | null; last_workout_at: string | null };

/** Friends for the row on top of the feed; working out now first. Checks every minute. */
export function useFriendsNow() {
  return useQuery({
    queryKey: ['friends-now'],
    refetchInterval: 60_000,
    queryFn: async () => must(await supabase.rpc('friends_now')) as FriendNow[],
  });
}

// --- Calendar ---------------------------------------------------------------------

/** A finished workout by you or a friend. `photo` (its first) is only ever set on yours. */
export type CalendarEntry = {
  workout_id: string;
  owner_id: string;
  username: string;
  title: string;
  started_at: string;
  photo: Photo | null;
};

/** Your and your friends' finished workouts from `from` up to (not including) `to`. */
export function useCalendar(from: Date, to: Date) {
  return useQuery({
    queryKey: ['calendar', from.toISOString(), to.toISOString()],
    queryFn: async () =>
      must(await supabase.rpc('get_calendar', { from_ts: from.toISOString(), to_ts: to.toISOString() } as never)) as CalendarEntry[],
  });
}

export type Profile = Person & {
  status: FriendStatus | 'self';
  since: string | null;
  active_since: string | null;
};
export type ProfileWorkout = { id: string; started_at: string; ended_at: string; volume_kg: number; set_count: number };
export type ProfileExercise = {
  exercise_id: string;
  name: string;
  sessions: number;
  best_weight_kg: number | null;
  best_reps: number | null;
  best_e1rm: number | null;
};

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    refetchInterval: 60_000,
    queryFn: async () => {
      const rows = must(await supabase.rpc('get_profile', { who: id } as never)) as Profile[];
      return rows[0] ?? null;
    },
  });
}

/** Their finished workouts you're allowed to see (empty unless you're friends). */
export function useProfileWorkouts(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['profile', id, 'workouts'],
    enabled,
    queryFn: async () =>
      (must(await supabase.rpc('get_profile_workouts', { who: id } as never)) as ProfileWorkout[]).map((w) => ({
        ...w,
        volume_kg: Number(w.volume_kg),
      })),
  });
}

export function useProfileExercises(id: string, enabled: boolean, max = 5) {
  return useQuery({
    queryKey: ['profile', id, 'exercises', max],
    enabled,
    queryFn: async () =>
      (must(await supabase.rpc('get_profile_exercises', { who: id, max_rows: max } as never)) as ProfileExercise[]).map(
        (x) => ({
          ...x,
          best_weight_kg: x.best_weight_kg == null ? null : Number(x.best_weight_kg),
          best_e1rm: x.best_e1rm == null ? null : Number(x.best_e1rm),
        }),
      ),
  });
}

export type ExerciseSession = {
  workout_id: string;
  started_at: string;
  best_weight_kg: number | null;
  best_reps: number | null;
  e1rm: number | null;
  max_weight_kg: number | null;
  max_reps: number | null;
};

/** One exercise over time for someone (best set, heaviest, most reps per session), oldest first. */
export function useExerciseHistory(userId: string, exerciseId: string) {
  return useQuery({
    queryKey: ['profile', userId, 'exercise', exerciseId],
    queryFn: async () => {
      const rows = must(
        await supabase.rpc('get_profile_exercise_history', { who: userId, ex: exerciseId } as never),
      ) as ExerciseSession[];
      const num = (v: unknown) => (v == null ? null : Number(v));
      return rows.map((r) => ({
        ...r,
        best_weight_kg: num(r.best_weight_kg),
        e1rm: num(r.e1rm),
        max_weight_kg: num(r.max_weight_kg),
      }));
    },
  });
}

// --- Notifications ----------------------------------------------------------------

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: async () =>
      must(
        await supabase
          .from('notifications')
          .select(
            'id, kind, workout_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url), workout:workouts(title)',
          )
          .order('created_at', { ascending: false })
          .limit(50),
      ) as unknown as AppNotification[],
  });
}

let channelSeq = 0;

/** Unread count for the bell, kept live with Supabase Realtime. */
export function useUnreadCount(): number {
  const { session } = useSession();
  const uid = session?.user.id;
  const q = useQuery({
    queryKey: keys.unread,
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!uid) return;
    // A fresh channel name each time: removeChannel is async, so when the screen
    // remounts the old channel can still exist, and reusing its name hands back that
    // already-subscribed channel ("cannot add postgres_changes callbacks after subscribe()").
    const channel = supabase
      .channel(`notifications:${uid}:${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        queryClient.invalidateQueries({ queryKey: keys.notifications });
        // A new friend request or acceptance changes the friends list too.
        queryClient.invalidateQueries({ queryKey: keys.friends });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid]);
  return q.data ?? 0;
}

export async function markNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() } as never)
    .is('read_at', null);
  if (!error) {
    queryClient.setQueryData(keys.unread, 0);
    queryClient.invalidateQueries({ queryKey: keys.notifications });
  }
}

/** Pull-to-refresh and "my own workout just synced" both use this. */
export const refreshFeed = () => queryClient.invalidateQueries({ queryKey: keys.feed });
