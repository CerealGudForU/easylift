-- EasyLift: likes on comments, comments carried in the feed (for the preview under each
-- card), and per-session history of one exercise for friend profiles.

-- Comment likes -------------------------------------------------------------------
create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on public.comment_likes (user_id);
alter table public.comment_likes enable row level security;

-- A comment is visible exactly when its workout is.
create or replace function private.can_view_comment(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.comments c where c.id = cid and private.can_view_workout(c.workout_id));
$$;
revoke execute on function private.can_view_comment(uuid) from public, anon;
grant execute on function private.can_view_comment(uuid) to authenticated;

create policy "comment_likes: see on visible comments" on public.comment_likes for select to authenticated
  using (private.can_view_comment(comment_id));
create policy "comment_likes: like visible comments" on public.comment_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_comment(comment_id));
create policy "comment_likes: unlike" on public.comment_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- A workout's comments with who wrote them and their likes, oldest first.
create or replace function public.get_comments(wid uuid)
returns table (id uuid, body text, created_at timestamptz, user_id uuid, username text, like_count int, liked boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.body, c.created_at, c.user_id, p.username::text,
    (select count(*) from public.comment_likes l where l.comment_id = c.id)::int,
    exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = (select auth.uid()))
  from public.comments c
  join public.profiles p on p.id = c.user_id
  where c.workout_id = wid
  order by c.created_at, c.id;
$$;

-- Feed: now with the 10 most recent comments for the preview under each card.
drop function public.get_feed(timestamptz, uuid, int, uuid);
create function public.get_feed(
  before_started timestamptz default null,
  before_id uuid default null,
  page_size int default 10,
  only_owner uuid default null
)
returns table (
  id uuid, owner_id uuid, username text, display_name text, avatar_url text, title text,
  started_at timestamptz, ended_at timestamptz, exercise_count int, set_count int, volume_kg numeric,
  top_exercises jsonb, like_count int, comment_count int, liked boolean, photos jsonb, comments jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id, w.owner_id, p.username::text, p.display_name, p.avatar_url, w.title, w.started_at, w.ended_at,
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
    exists (select 1 from public.likes l where l.workout_id = w.id and l.user_id = (select auth.uid())),
    (select coalesce(jsonb_agg(jsonb_build_object(
        'id', ph.id, 'path', ph.path, 'width', ph.width, 'height', ph.height,
        'crop_x', ph.crop_x, 'crop_y', ph.crop_y, 'crop_w', ph.crop_w, 'crop_h', ph.crop_h
      ) order by ph.position, ph.created_at), '[]'::jsonb)
      from public.workout_photos ph where ph.workout_id = w.id),
    (select coalesce(jsonb_agg(to_jsonb(cm) order by cm.created_at desc, cm.id), '[]'::jsonb)
      from (
        select c.id, c.body, c.created_at, c.user_id, cp.username::text as username,
          (select count(*) from public.comment_likes l where l.comment_id = c.id)::int as like_count,
          exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = (select auth.uid())) as liked
        from public.comments c
        join public.profiles cp on cp.id = c.user_id
        where c.workout_id = w.id
        order by c.created_at desc, c.id
        limit 10
      ) cm)
  from public.workouts w
  join public.profiles p on p.id = w.owner_id
  where w.deleted_at is null
    and w.ended_at is not null
    and w.visibility = 'friends'
    and (w.owner_id = (select auth.uid()) or private.is_friend((select auth.uid()), w.owner_id))
    and (only_owner is null or w.owner_id = only_owner)
    and (before_started is null or (w.started_at, w.id) < (before_started, before_id))
  order by w.started_at desc, w.id desc
  limit least(greatest(page_size, 1), 50);
$$;

-- All their exercises (not just the top 5) for the full list on a profile.
create or replace function public.get_profile_exercises(who uuid, max_rows int default 5)
returns table (exercise_id uuid, name text, sessions int, best_weight_kg numeric, best_reps int, best_e1rm numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with sets as (
    select we.exercise_id, s.workout_id, s.weight_kg, s.reps,
      case when coalesce(s.reps, 0) <= 0 or coalesce(s.weight_kg, 0) <= 0 then 0
           when s.reps = 1 then s.weight_kg
           else s.weight_kg * (1 + s.reps / 30.0) end as e1rm
    from public.workout_sets s
    join public.workout_exercises we on we.id = s.workout_exercise_id and we.deleted_at is null
    join public.workouts w on w.id = s.workout_id and w.deleted_at is null and w.ended_at is not null
    where s.owner_id = who and s.deleted_at is null and s.completed_at is not null and s.set_type <> 'warmup'
  ),
  best as (
    select distinct on (exercise_id) exercise_id, weight_kg, reps, e1rm
    from sets order by exercise_id, e1rm desc, reps desc
  )
  select e.id, e.name, count(distinct s.workout_id)::int, b.weight_kg, b.reps, round(b.e1rm::numeric, 1)
  from sets s
  join best b on b.exercise_id = s.exercise_id
  join public.exercises e on e.id = s.exercise_id
  group by e.id, e.name, b.weight_kg, b.reps, b.e1rm
  order by count(distinct s.workout_id) desc, e.name
  limit least(greatest(max_rows, 1), 500);
$$;

-- One exercise over time for someone: per session, the best set (by Epley est. 1RM),
-- the heaviest weight and the most reps in a set.
create or replace function public.get_profile_exercise_history(who uuid, ex uuid)
returns table (workout_id uuid, started_at timestamptz, best_weight_kg numeric, best_reps int, e1rm numeric, max_weight_kg numeric, max_reps int)
language sql
stable
security invoker
set search_path = ''
as $$
  with sets as (
    select w.id as workout_id, w.started_at, s.weight_kg, s.reps,
      case when coalesce(s.reps, 0) <= 0 or coalesce(s.weight_kg, 0) <= 0 then 0
           when s.reps = 1 then s.weight_kg
           else s.weight_kg * (1 + s.reps / 30.0) end as e1rm
    from public.workout_sets s
    join public.workout_exercises we on we.id = s.workout_exercise_id and we.deleted_at is null and we.exercise_id = ex
    join public.workouts w on w.id = s.workout_id and w.deleted_at is null and w.ended_at is not null
    where s.owner_id = who and s.deleted_at is null and s.completed_at is not null and s.set_type <> 'warmup'
  ),
  best as (
    select distinct on (workout_id) workout_id, weight_kg, reps, e1rm from sets order by workout_id, e1rm desc, reps desc
  )
  select s.workout_id, min(s.started_at), b.weight_kg, b.reps, round(b.e1rm::numeric, 1),
    max(s.weight_kg), max(s.reps)
  from sets s join best b on b.workout_id = s.workout_id
  group by s.workout_id, b.weight_kg, b.reps, b.e1rm
  order by min(s.started_at);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.get_feed(timestamptz, uuid, int, uuid)', 'public.get_comments(uuid)',
    'public.get_profile_exercises(uuid, int)', 'public.get_profile_exercise_history(uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
