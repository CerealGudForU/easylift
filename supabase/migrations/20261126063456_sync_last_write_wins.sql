-- Offline sync is last-write-wins on client_updated_at. A device that comes back
-- online with an older copy of a row must not overwrite a newer edit: the update
-- is silently skipped (returning null drops just that row from the upsert).
create or replace function private.keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_updated_at < old.client_updated_at then
    return null;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'routines', 'routine_exercises', 'routine_sets', 'workouts',
    'workout_exercises', 'workout_sets', 'body_measurements'
  ] loop
    -- "a_" so it fires before the other before-update triggers (they run by name).
    execute format('create trigger %I before update on public.%I for each row execute function private.keep_newest()', 'a_' || t || '_keep_newest', t);
  end loop;
end;
$$;
