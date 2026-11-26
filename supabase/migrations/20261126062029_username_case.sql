-- Usernames keep the capitals the user chose ("EthanG") for display, but stay
-- unique and matched case-insensitively (citext): "ethang" can't also register,
-- and signing in with any casing finds the same account. The login email is
-- always derived from the lowercased name.

alter table public.profiles drop constraint username_format;
alter table public.profiles add constraint username_format
  check (username::text ~ '^[A-Za-z0-9_.]{3,20}$');

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text := trim(new.raw_user_meta_data ->> 'username');
begin
  if uname is null or uname !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'invalid username' using errcode = '22023';
  end if;
  insert into public.profiles (id, username) values (new.id, uname);
  return new;
end;
$$;

create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select trim(name) ~ '^[A-Za-z0-9_.]{3,20}$'
     and not exists (
       -- citext's "=" must be named: with search_path = '' a bare "=" compares as text.
       select 1 from public.profiles p
       where p.username operator(extensions.=) trim(name)::extensions.citext
     );
$$;
