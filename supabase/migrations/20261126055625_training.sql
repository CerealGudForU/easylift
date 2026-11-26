-- EasyLift: exercises, routines, workouts, records, measurements, likes, comments.
-- Rows are created offline with client-generated UUIDs and synced last-write-wins
-- on client_updated_at. updated_at is the server's change time (for pulls);
-- deleted_at is a tombstone so deletes sync too. Weight is always kg.

create type public.set_type as enum ('normal', 'warmup', 'failure', 'drop');
create type public.exercise_kind as enum ('weight_reps', 'reps', 'weighted_bodyweight', 'time', 'distance_time');
create type public.workout_visibility as enum ('friends', 'private');

-- Exercises: owner_id null = global library -----------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  source_id text unique,
  name text not null constraint exercise_name_length check (char_length(name) between 1 and 80),
  kind public.exercise_kind not null default 'weight_reps',
  category text,
  primary_muscle text,
  secondary_muscles text[] not null default '{}',
  equipment text,
  force text,
  level text,
  mechanic text,
  instructions text[] not null default '{}',
  images text[] not null default '{}',
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index exercises_owner_idx on public.exercises (owner_id);
create index exercises_name_idx on public.exercises (lower(name));
create trigger exercises_touch before update on public.exercises
  for each row execute function private.touch_updated_at();
alter table public.exercises enable row level security;

-- Friends can see your custom exercises so your workouts read properly in their feed.
create policy "exercises: library, own and friends'" on public.exercises for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()) or private.is_friend((select auth.uid()), owner_id));
create policy "exercises: add own" on public.exercises for insert to authenticated
  with check (owner_id = (select auth.uid()) and source_id is null);
create policy "exercises: edit own" on public.exercises for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and source_id is null);
create policy "exercises: delete own" on public.exercises for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Routines ---------------------------------------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null constraint routine_name_length check (char_length(name) between 1 and 80),
  folder text,
  position integer not null default 0,
  notes text,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index routines_owner_idx on public.routines (owner_id, updated_at);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position integer not null default 0,
  superset_group integer,
  rest_seconds integer constraint routine_rest_range check (rest_seconds between 0 and 600),
  notes text,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id);
create index routine_exercises_owner_idx on public.routine_exercises (owner_id, updated_at);
create index routine_exercises_exercise_idx on public.routine_exercises (exercise_id);

create table public.routine_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises (id) on delete cascade,
  position integer not null default 0,
  set_type public.set_type not null default 'normal',
  target_reps integer constraint target_reps_range check (target_reps between 0 and 999),
  target_weight_kg numeric(6, 2) constraint target_weight_range check (target_weight_kg between 0 and 9999),
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index routine_sets_parent_idx on public.routine_sets (routine_exercise_id);
create index routine_sets_owner_idx on public.routine_sets (owner_id, updated_at);

-- Workouts ---------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  title text not null default 'Workout' constraint workout_title_length check (char_length(title) between 1 and 80),
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text constraint workout_notes_length check (char_length(notes) <= 2000),
  visibility public.workout_visibility not null default 'friends',
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ended_after_start check (ended_at is null or ended_at >= started_at)
);
create index workouts_owner_idx on public.workouts (owner_id, updated_at);
create index workouts_feed_idx on public.workouts (owner_id, started_at desc, id desc)
  where deleted_at is null and ended_at is not null;
create index workouts_routine_idx on public.workouts (routine_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  position integer not null default 0,
  superset_group integer,
  rest_seconds integer constraint workout_rest_range check (rest_seconds between 0 and 600),
  notes text,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index workout_exercises_owner_idx on public.workout_exercises (owner_id, updated_at);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  position integer not null default 0,
  set_type public.set_type not null default 'normal',
  weight_kg numeric(6, 2) constraint weight_range check (weight_kg between 0 and 9999),
  reps integer constraint reps_range check (reps between 0 and 999),
  rpe numeric(3, 1) constraint rpe_range check (rpe between 1 and 10),
  duration_s integer constraint duration_range check (duration_s >= 0),
  distance_m numeric(9, 2) constraint distance_range check (distance_m >= 0),
  completed_at timestamptz,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workout_sets_parent_idx on public.workout_sets (workout_exercise_id);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_owner_idx on public.workout_sets (owner_id, updated_at);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null constraint pr_kind check (kind in ('e1rm', 'weight', 'reps', 'volume')),
  value numeric(10, 2) not null,
  workout_set_id uuid references public.workout_sets (id) on delete cascade,
  achieved_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index personal_records_owner_idx on public.personal_records (owner_id, exercise_id, kind);
create index personal_records_exercise_idx on public.personal_records (exercise_id);
create index personal_records_set_idx on public.personal_records (workout_set_id);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) constraint body_weight_range check (weight_kg between 0 and 999),
  body_fat_pct numeric(4, 1) constraint body_fat_range check (body_fat_pct between 0 and 100),
  notes text,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index body_measurements_owner_idx on public.body_measurements (owner_id, updated_at);

-- updated_at triggers + owner-only RLS for every private table -----------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'routines', 'routine_exercises', 'routine_sets', 'workouts', 'workout_exercises',
    'workout_sets', 'personal_records', 'body_measurements'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || ': owner', t);
  end loop;
end;
$$;

-- Children must belong to a parent the same user owns.
create or replace function private.check_parent_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
begin
  case tg_table_name
    when 'routine_exercises' then
      select r.owner_id = new.owner_id into ok from public.routines r where r.id = new.routine_id;
    when 'routine_sets' then
      select r.owner_id = new.owner_id into ok from public.routine_exercises r where r.id = new.routine_exercise_id;
    when 'workout_exercises' then
      select w.owner_id = new.owner_id into ok from public.workouts w where w.id = new.workout_id;
    when 'workout_sets' then
      select we.owner_id = new.owner_id and we.workout_id = new.workout_id into ok
      from public.workout_exercises we where we.id = new.workout_exercise_id;
    when 'personal_records' then
      ok := new.workout_set_id is null
        or exists (select 1 from public.workout_sets s where s.id = new.workout_set_id and s.owner_id = new.owner_id);
  end case;
  if not coalesce(ok, false) then
    raise exception 'parent row not found or not owned' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['routine_exercises', 'routine_sets', 'workout_exercises', 'workout_sets', 'personal_records'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.check_parent_owner()', t || '_parent_owner', t);
  end loop;
end;
$$;

-- Friends can read finished, non-private workouts -------------------------------
create or replace function private.can_view_workout(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = wid
      and (
        w.owner_id = auth.uid()
        or (w.visibility = 'friends' and w.deleted_at is null and w.ended_at is not null
            and private.is_friend(auth.uid(), w.owner_id))
      )
  );
$$;

create policy "workouts: friends read" on public.workouts for select to authenticated
  using (visibility = 'friends' and deleted_at is null and ended_at is not null
         and private.is_friend((select auth.uid()), owner_id));
create policy "workout_exercises: friends read" on public.workout_exercises for select to authenticated
  using (deleted_at is null and private.can_view_workout(workout_id));
create policy "workout_sets: friends read" on public.workout_sets for select to authenticated
  using (deleted_at is null and private.can_view_workout(workout_id));
create policy "personal_records: friends read" on public.personal_records for select to authenticated
  using (private.is_friend((select auth.uid()), owner_id));

-- Likes and comments, only on workouts you can see -----------------------------
create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);
create index likes_user_idx on public.likes (user_id);
alter table public.likes enable row level security;

create policy "likes: see on visible workouts" on public.likes for select to authenticated
  using (private.can_view_workout(workout_id));
create policy "likes: like visible workouts" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_workout(workout_id));
create policy "likes: unlike" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null constraint comment_length check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_workout_idx on public.comments (workout_id, created_at);
create index comments_user_idx on public.comments (user_id);
alter table public.comments enable row level security;

revoke update on public.comments from anon, authenticated;

create policy "comments: see on visible workouts" on public.comments for select to authenticated
  using (private.can_view_workout(workout_id));
create policy "comments: comment on visible workouts" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_workout(workout_id));
-- Delete your own comment, or any comment on your own workout.
create policy "comments: delete" on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.workouts w where w.id = workout_id and w.owner_id = (select auth.uid()))
  );

alter table public.notifications
  add constraint notifications_workout_fk foreign key (workout_id) references public.workouts (id) on delete cascade;
create index notifications_workout_idx on public.notifications (workout_id);

create or replace function private.notify_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select w.owner_id into owner from public.workouts w where w.id = new.workout_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, kind, actor_id, workout_id)
    values (owner, case when tg_table_name = 'likes' then 'like' else 'comment' end, new.user_id, new.workout_id);
  end if;
  return new;
end;
$$;
create trigger likes_notify after insert on public.likes
  for each row execute function private.notify_reaction();
create trigger comments_notify after insert on public.comments
  for each row execute function private.notify_reaction();
