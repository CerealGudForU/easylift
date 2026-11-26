-- EasyLift Phase 6: feed, friend search and friend list (PLAN.md §4.2).
-- Every function here is SECURITY INVOKER: they only shape rows the caller can
-- already read, so the RLS policies stay the single place that decides who sees what.

-- Feed: finished, friends-visible workouts by you and your friends, newest first.
-- Keyset pagination: pass the last row's (started_at, id) to get the next page.
create or replace function public.get_feed(
  before_started timestamptz default null,
  before_id uuid default null,
  page_size int default 10
)
returns table (
  id uuid,
  owner_id uuid,
  username text,
  display_name text,
  avatar_url text,
  title text,
  started_at timestamptz,
  ended_at timestamptz,
  exercise_count int,
  set_count int,
  volume_kg numeric,
  top_exercises jsonb,
  like_count int,
  comment_count int,
  liked boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id,
    w.owner_id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    w.title,
    w.started_at,
    w.ended_at,
    (select count(*) from public.workout_exercises we
      where we.workout_id = w.id and we.deleted_at is null)::int,
    (select count(*) from public.workout_sets s
      where s.workout_id = w.id and s.deleted_at is null and s.completed_at is not null)::int,
    (select coalesce(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)), 0) from public.workout_sets s
      where s.workout_id = w.id and s.deleted_at is null and s.completed_at is not null and s.set_type <> 'warmup'),
    (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'sets', x.sets) order by x.position), '[]'::jsonb)
      from (
        select we.position, coalesce(e.name, 'Exercise') as name,
          (select count(*) from public.workout_sets s
            where s.workout_exercise_id = we.id and s.deleted_at is null and s.completed_at is not null)::int as sets
        from public.workout_exercises we
        left join public.exercises e on e.id = we.exercise_id
        where we.workout_id = w.id and we.deleted_at is null
        order by we.position
        limit 3
      ) x),
    (select count(*) from public.likes l where l.workout_id = w.id)::int,
    (select count(*) from public.comments c where c.workout_id = w.id)::int,
    exists (select 1 from public.likes l where l.workout_id = w.id and l.user_id = (select auth.uid()))
  from public.workouts w
  join public.profiles p on p.id = w.owner_id
  where w.deleted_at is null
    and w.ended_at is not null
    and w.visibility = 'friends'
    and (w.owner_id = (select auth.uid()) or private.is_friend((select auth.uid()), w.owner_id))
    and (before_started is null or (w.started_at, w.id) < (before_started, before_id))
  order by w.started_at desc, w.id desc
  limit least(greatest(page_size, 1), 50);
$$;

-- Username search for adding friends. Prefix match, ignoring case; you never find
-- yourself, and blocks hide both ways (profiles RLS).
create or replace function public.search_profiles(q text)
returns table (id uuid, username text, display_name text, avatar_url text, status text)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    case
      when f.status = 'accepted' then 'friends'
      when f.requested_by = (select auth.uid()) then 'sent'
      when f.status = 'pending' then 'received'
      else 'none'
    end
  from public.profiles p
  left join public.friendships f
    on f.user_a = least(p.id, (select auth.uid())) and f.user_b = greatest(p.id, (select auth.uid()))
  where p.id <> (select auth.uid())
    and char_length(trim(q)) >= 1
    and lower(p.username::text) like replace(replace(replace(lower(trim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by char_length(p.username::text), lower(p.username::text)
  limit 20;
$$;

-- Your friends, plus requests you sent and received, with the other person's profile.
create or replace function public.list_friends()
returns table (id uuid, username text, display_name text, avatar_url text, status text, since timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    case
      when f.status = 'accepted' then 'friends'
      when f.requested_by = (select auth.uid()) then 'sent'
      else 'received'
    end,
    coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b)
  order by lower(p.username::text);
$$;

revoke execute on function public.get_feed(timestamptz, uuid, int) from public, anon;
revoke execute on function public.search_profiles(text) from public, anon;
revoke execute on function public.list_friends() from public, anon;
grant execute on function public.get_feed(timestamptz, uuid, int) to authenticated;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.list_friends() to authenticated;

-- Feed lookups by friend: the existing workouts_feed_idx covers (owner_id, started_at desc, id desc).
-- Username prefix search.
create index if not exists profiles_username_prefix_idx on public.profiles (lower(username::text) text_pattern_ops);

-- The in-app bell listens for new notifications (Realtime respects RLS).
alter publication supabase_realtime add table public.notifications;
