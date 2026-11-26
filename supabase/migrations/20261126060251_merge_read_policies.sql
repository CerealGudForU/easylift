-- One SELECT policy per table (advisor: multiple_permissive_policies).
-- The owner's "for all" policy is split into insert/update/delete, and reads
-- (owner OR visible to a friend) become a single policy.

do $$
declare
  t text;
begin
  foreach t in array array['workouts', 'workout_exercises', 'workout_sets', 'personal_records'] loop
    execute format('drop policy %I on public.%I', t || ': owner', t);
    execute format('drop policy %I on public.%I', t || ': friends read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))', t || ': owner insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || ': owner update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))', t || ': owner delete', t);
  end loop;
end;
$$;

create policy "workouts: read own or friends'" on public.workouts for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility = 'friends' and deleted_at is null and ended_at is not null
        and private.is_friend((select auth.uid()), owner_id))
  );
create policy "workout_exercises: read own or friends'" on public.workout_exercises for select to authenticated
  using (owner_id = (select auth.uid()) or (deleted_at is null and private.can_view_workout(workout_id)));
create policy "workout_sets: read own or friends'" on public.workout_sets for select to authenticated
  using (owner_id = (select auth.uid()) or (deleted_at is null and private.can_view_workout(workout_id)));
create policy "personal_records: read own or friends'" on public.personal_records for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_friend((select auth.uid()), owner_id));

comment on function public.username_available(text) is
  'Intentionally callable by anon: live "username taken" check on the sign-up screen. Returns only a boolean.';
