-- EasyLift: friends, blocks, notifications (PLAN.md §4.2).

-- Blocks ---------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint not_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;

create or replace function private.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create policy "blocks: own" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "blocks: add own" on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "blocks: remove own" on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Profiles are visible to signed-in users, except across a block.
create policy "profiles: readable unless blocked" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or not private.is_blocked((select auth.uid()), id));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Friendships: one row per pair (user_a < user_b) ------------------------------
create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  constraint ordered_pair check (user_a < user_b),
  constraint requester_in_pair check (requested_by in (user_a, user_b))
);
create index friendships_user_b_idx on public.friendships (user_b);
create index friendships_requested_by_idx on public.friendships (requested_by);
alter table public.friendships enable row level security;

-- Only the status can change (pending → accepted); everything else is fixed.
revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

create or replace function private.is_friend(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_a = least(a, b) and f.user_b = greatest(a, b) and f.status = 'accepted'
  );
$$;

create policy "friendships: see own" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "friendships: request" on public.friendships for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and (select auth.uid()) in (user_a, user_b)
    and status = 'pending'
    and not private.is_blocked(user_a, user_b)
  );
-- Only the person who received the request can accept it.
create policy "friendships: accept" on public.friendships for update to authenticated
  using ((select auth.uid()) in (user_a, user_b) and requested_by <> (select auth.uid()) and status = 'pending')
  with check (status = 'accepted');
-- Decline, cancel and unfriend are all a delete by either side.
create policy "friendships: remove" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create or replace function private.friendship_accepted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;
create trigger friendships_accepted_at before update on public.friendships
  for each row execute function private.friendship_accepted_at();

-- A block ends any friendship or pending request between the two.
create or replace function private.block_removes_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;
create trigger blocks_remove_friendship after insert on public.blocks
  for each row execute function private.block_removes_friendship();

-- Notifications (written by triggers only) -------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null constraint notification_kind
    check (kind in ('friend_request', 'friend_accepted', 'like', 'comment')),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
alter table public.notifications enable row level security;

revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: see own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: mark read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: dismiss" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, actor_id) values (other, 'friend_request', new.requested_by);
  elsif new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, kind, actor_id) values (new.requested_by, 'friend_accepted', other);
  end if;
  return new;
end;
$$;
create trigger friendships_notify after insert or update on public.friendships
  for each row execute function private.notify_friendship();
