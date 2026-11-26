-- EasyLift: several photos per workout with a free crop, friend profiles, and
-- "working out now". Everything here is read through RLS (SECURITY INVOKER) except
-- one private helper that reveals only *when* a friend's open workout started.

-- Photos ------------------------------------------------------------------------
-- The original file is kept; the crop is a normalised rectangle (0..1 of the
-- original's width/height) applied when drawing, so a photo can be re-cropped any time.
create table public.workout_photos (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  path text not null constraint workout_photo_path_length check (char_length(path) <= 200),
  position int not null default 0,
  width int not null constraint photo_width check (width > 0),
  height int not null constraint photo_height check (height > 0),
  crop_x real not null default 0,
  crop_y real not null default 0,
  crop_w real not null default 1,
  crop_h real not null default 1,
  created_at timestamptz not null default now(),
  constraint crop_in_bounds check (
    crop_x >= 0 and crop_y >= 0 and crop_w > 0.01 and crop_h > 0.01
    and crop_x + crop_w <= 1.001 and crop_y + crop_h <= 1.001
  ),
  constraint workout_photo_in_own_folder check (path like owner_id::text || '/' || workout_id::text || '/%')
);
create index workout_photos_workout_idx on public.workout_photos (workout_id, position);
create index workout_photos_owner_idx on public.workout_photos (owner_id);
alter table public.workout_photos enable row level security;

-- Only the crop and order can change after upload.
revoke update on public.workout_photos from anon, authenticated;
grant update (position, crop_x, crop_y, crop_w, crop_h) on public.workout_photos to authenticated;

create policy "workout_photos: read own or visible" on public.workout_photos for select to authenticated
  using (owner_id = (select auth.uid()) or private.can_view_workout(workout_id));
create policy "workout_photos: add to own workout" on public.workout_photos for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.owner_id = (select auth.uid()))
  );
create policy "workout_photos: edit own" on public.workout_photos for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "workout_photos: delete own" on public.workout_photos for delete to authenticated
  using (owner_id = (select auth.uid()));

-- At most 10 photos per workout.
create or replace function private.limit_workout_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.workout_photos p where p.workout_id = new.workout_id) >= 10 then
    raise exception 'A workout can have at most 10 photos';
  end if;
  return new;
end;
$$;
create trigger workout_photos_limit before insert on public.workout_photos
  for each row execute function private.limit_workout_photos();

-- Move the single photos over (they were all cropped square), then drop the old column.
insert into public.workout_photos (workout_id, owner_id, path, position, width, height)
  select id, owner_id, photo_path, 0, 1000, 1000 from public.workouts where photo_path is not null;
alter table public.workouts drop constraint workout_photo_in_own_folder;
alter table public.workouts drop column photo_path;

-- Feed ----------------------------------------------------------------------------
-- Now with every photo, and optionally one person's workouts only (their profile).
drop function public.get_feed(timestamptz, uuid, int);
create function public.get_feed(
  before_started timestamptz default null,
  before_id uuid default null,
  page_size int default 10,
  only_owner uuid default null
)
returns table (
  id uuid, owner_id uuid, username text, display_name text, avatar_url text, title text,
  started_at timestamptz, ended_at timestamptz, exercise_count int, set_count int, volume_kg numeric,
  top_exercises jsonb, like_count int, comment_count int, liked boolean, photos jsonb
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
      from public.workout_photos ph where ph.workout_id = w.id)
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

-- Working out now -------------------------------------------------------------------
-- When the given person's open (unfinished, friends-visible) workout started, if it
-- started in the last 6 hours, and only if the caller is that person or a friend.
-- SECURITY DEFINER because RLS hides unfinished workouts from friends; it returns a
-- timestamp only, never the workout.
create or replace function private.active_since(who uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(w.started_at)
  from public.workouts w
  where w.owner_id = who
    and w.ended_at is null
    and w.deleted_at is null
    and w.visibility = 'friends'
    and w.started_at > now() - interval '6 hours'
    and (who = auth.uid() or private.is_friend(auth.uid(), who));
$$;

-- Your friends for the row at the top of the feed: working out now first, then by
-- their latest workout.
create or replace function public.friends_now()
returns table (id uuid, username text, display_name text, avatar_url text, active_since timestamptz, last_workout_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select x.* from (
    select
      p.id, p.username::text, p.display_name, p.avatar_url,
      private.active_since(p.id) as active_since,
      (select max(w.ended_at) from public.workouts w
        where w.owner_id = p.id and w.deleted_at is null and w.ended_at is not null) as last_workout_at
    from public.friendships f
    join public.profiles p on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
    where (select auth.uid()) in (f.user_a, f.user_b) and f.status = 'accepted'
  ) x
  order by (x.active_since is null), x.active_since desc, x.last_workout_at desc nulls last, lower(x.username);
$$;

-- Profiles --------------------------------------------------------------------------
-- Someone's public card plus how you're connected. Training stats come from
-- get_profile_workouts / get_profile_exercises, which only return what RLS lets you see.
create or replace function public.get_profile(who uuid)
returns table (id uuid, username text, display_name text, avatar_url text, status text, since timestamptz, active_since timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.avatar_url,
    case
      when p.id = (select auth.uid()) then 'self'
      when f.status = 'accepted' then 'friends'
      when f.requested_by = (select auth.uid()) then 'sent'
      when f.status = 'pending' then 'received'
      else 'none'
    end,
    coalesce(f.accepted_at, f.created_at),
    private.active_since(p.id)
  from public.profiles p
  left join public.friendships f
    on f.user_a = least(p.id, (select auth.uid())) and f.user_b = greatest(p.id, (select auth.uid()))
  where p.id = who;
$$;

-- One row per finished workout you can see, for their charts and totals.
create or replace function public.get_profile_workouts(who uuid)
returns table (id uuid, started_at timestamptz, ended_at timestamptz, volume_kg numeric, set_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id, w.started_at, w.ended_at,
    coalesce(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0)) filter (where s.set_type <> 'warmup'), 0),
    count(s.id)::int
  from public.workouts w
  left join public.workout_sets s
    on s.workout_id = w.id and s.deleted_at is null and s.completed_at is not null
  where w.owner_id = who and w.deleted_at is null and w.ended_at is not null
  group by w.id
  order by w.started_at desc
  limit 1000;
$$;

-- Their most trained exercises with their best set (Epley estimated 1RM, as in the app).
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
  limit least(greatest(max_rows, 1), 20);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.get_feed(timestamptz, uuid, int, uuid)', 'public.friends_now()', 'public.get_profile(uuid)',
    'public.get_profile_workouts(uuid)', 'public.get_profile_exercises(uuid, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
revoke execute on function private.active_since(uuid) from public, anon;
grant execute on function private.active_since(uuid) to authenticated;
