-- EasyLift: profiles + username login (PLAN.md §4.1).
-- Users sign up with a username; the app maps it to a synthetic email
-- `<username>@users.easylift.invalid` that is never shown or exposed.

create extension if not exists citext with schema extensions;

-- Helpers used by RLS live in a schema PostgREST does not expose, so they
-- can't be called directly through the API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- Shared trigger: server-side change time, used by sync to pull "changes since".
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    constraint username_format check (username::text ~ '^[a-z0-9_.]{3,20}$'),
  display_name text constraint display_name_length check (char_length(display_name) <= 40),
  avatar_url text,
  units text not null default 'kg' constraint units_kind check (units in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public identity. Holds no email: the synthetic auth email stays in auth.users.';

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;

-- Usernames are immutable: the login email is derived from them.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, units) on public.profiles to authenticated;

-- Create the profile when the auth user is created. Signing up without a valid
-- username fails the whole sign-up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text := lower(trim(new.raw_user_meta_data ->> 'username'));
begin
  if uname is null or uname !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'invalid username' using errcode = '22023';
  end if;
  insert into public.profiles (id, username) values (new.id, uname);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Live "username taken" feedback on the sign-up screen (callable before sign-in).
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(trim(name)) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = lower(trim(name))::extensions.citext);
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
