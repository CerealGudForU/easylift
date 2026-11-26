-- EasyLift: one photo per workout, shown with it in the feed.
-- Files live at workout-photos/<owner id>/<workout id>/<random>.jpg in a private bucket.
-- Whoever can see the workout (RLS: owner, or a friend when it's friends-visible) can
-- read its photo; only the owner can add or remove files in their own folder.

alter table public.workouts
  add column photo_path text constraint workout_photo_path_length check (char_length(photo_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-photos', 'workout-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- The workout id from a photo path, or null if the path isn't shaped like one.
create or replace function private.photo_workout_id(path text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(path, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(path, '/', 2)::uuid
  end;
$$;

create policy "workout photos: read visible" on storage.objects for select to authenticated
  using (
    bucket_id = 'workout-photos'
    and (
      split_part(name, '/', 1) = (select auth.uid())::text
      or private.can_view_workout(private.photo_workout_id(name))
    )
  );
create policy "workout photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'workout-photos' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "workout photos: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'workout-photos' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'workout-photos' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "workout photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'workout-photos' and split_part(name, '/', 1) = (select auth.uid())::text);

-- A photo path must point into the owner's own folder for this workout.
alter table public.workouts add constraint workout_photo_in_own_folder
  check (photo_path is null or photo_path like owner_id::text || '/' || id::text || '/%');

-- The feed now carries the photo path (the return type changes, so drop and recreate).
drop function public.get_feed(timestamptz, uuid, int);
create function public.get_feed(
  before_started timestamptz default null,
  before_id uuid default null,
  page_size int default 10
)
returns table (
  id uuid, owner_id uuid, username text, display_name text, avatar_url text, title text,
  started_at timestamptz, ended_at timestamptz, exercise_count int, set_count int, volume_kg numeric,
  top_exercises jsonb, like_count int, comment_count int, liked boolean, photo_path text
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
    exists (select 1 from public.likes l where l.workout_id = w.id and l.user_id = (select auth.uid())),
    w.photo_path
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
revoke execute on function public.get_feed(timestamptz, uuid, int) from public, anon;
grant execute on function public.get_feed(timestamptz, uuid, int) to authenticated;
