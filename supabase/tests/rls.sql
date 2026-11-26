-- RLS and trigger tests. Run in the SQL editor (or via the Supabase MCP).
-- Everything happens inside one block that always ends by raising an
-- exception, so all test data is rolled back.
--   Success: ERROR "ALL RLS TESTS PASSED"
--   Failure: ERROR "FAIL: <what>"
do $$
declare
  a uuid := gen_random_uuid();  -- owner
  b uuid := gen_random_uuid();  -- A's friend
  c uuid := gen_random_uuid();  -- stranger
  ex uuid := gen_random_uuid();
  w_public uuid := gen_random_uuid();
  w_private uuid := gen_random_uuid();
  w_open uuid := gen_random_uuid();
  we uuid := gen_random_uuid();
  n int;
  failed boolean;
begin
  -- Setup (as postgres) -------------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'rls_a@test.invalid', '{"username":"rls_a"}'),
    (b, 'rls_b@test.invalid', '{"username":"RLS_B"}'),
    (c, 'rls_c@test.invalid', '{"username":"rls_c"}');
  if (select username::text from public.profiles where id = b) <> 'RLS_B' then
    raise exception 'FAIL: profile trigger should keep the chosen capitals';
  end if;

  failed := false;
  begin
    insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'bad@test.invalid', '{"username":"x"}');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: sign-up with an invalid username should fail'; end if;
  failed := false;
  begin
    insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'dupe@test.invalid', '{"username":"RLS_A"}');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: usernames should be unique ignoring case'; end if;

  insert into public.friendships (user_a, user_b, requested_by, status)
    values (least(a, b), greatest(a, b), a, 'accepted');
  insert into public.exercises (id, name, source_id) values (ex, 'RLS test press', 'rls_test_press');
  insert into public.workouts (id, owner_id, started_at, ended_at, visibility) values
    (w_public, a, now() - interval '1 hour', now(), 'friends'),
    (w_private, a, now() - interval '1 hour', now(), 'private'),
    (w_open, a, now() - interval '10 minutes', null, 'friends');
  insert into public.workout_exercises (id, owner_id, workout_id, exercise_id) values (we, a, w_public, ex);
  insert into public.workout_sets (owner_id, workout_id, workout_exercise_id, weight_kg, reps) values (a, w_public, we, 80, 8);

  execute 'set local role authenticated';

  -- B: friend ----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.workouts where owner_id = a;
  if n <> 1 then raise exception 'FAIL: friend should see only the finished friends workout (saw %)', n; end if;
  select count(*) into n from public.workout_sets where workout_id = w_public;
  if n <> 1 then raise exception 'FAIL: friend should see the sets of a visible workout'; end if;
  insert into public.likes (workout_id) values (w_public);
  insert into public.comments (workout_id, body) values (w_public, 'Strong!');

  failed := false;
  begin
    insert into public.likes (workout_id) values (w_private);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: liking a private workout should fail'; end if;

  failed := false;
  begin
    insert into public.workouts (owner_id, started_at) values (a, now());
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: creating a workout for someone else should fail'; end if;

  update public.workouts set title = 'hacked' where id = w_public;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: friend should not edit the owner''s workout'; end if;

  failed := false;
  begin
    insert into public.workout_exercises (owner_id, workout_id, exercise_id) values (b, w_public, ex);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: adding to someone else''s workout should fail'; end if;

  failed := false;
  begin
    insert into public.exercises (owner_id, name) values (null, 'Global spam');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: users should not add global exercises'; end if;

  failed := false;
  begin
    update public.profiles set username = 'renamed' where id = b;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: usernames should be immutable'; end if;

  update public.profiles set display_name = 'Bee' where id = b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: user should edit their own display name'; end if;
  update public.profiles set display_name = 'hacked' where id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user should not edit another profile'; end if;

  -- C: stranger --------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.workouts where owner_id = a;
  if n <> 0 then raise exception 'FAIL: stranger should see no workouts'; end if;
  select count(*) into n from public.workout_sets where workout_id = w_public;
  if n <> 0 then raise exception 'FAIL: stranger should see no sets'; end if;
  select count(*) into n from public.comments where workout_id = w_public;
  if n <> 0 then raise exception 'FAIL: stranger should see no comments'; end if;
  select count(*) into n from public.profiles where id = a;
  if n <> 1 then raise exception 'FAIL: stranger should find A by username'; end if;
  select count(*) into n from public.notifications;
  if n <> 0 then raise exception 'FAIL: stranger should see no notifications'; end if;

  failed := false;
  begin
    insert into public.likes (workout_id) values (w_public);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: stranger should not like a workout'; end if;

  -- Friend request flow: C asks A.
  insert into public.friendships (user_a, user_b, requested_by) values (least(a, c), greatest(a, c), c);
  update public.friendships set status = 'accepted' where user_a = least(a, c) and user_b = greatest(a, c);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: requester should not accept their own request'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.workouts where owner_id = a;
  if n <> 3 then raise exception 'FAIL: owner should see all own workouts, incl. private and unfinished (saw %)', n; end if;
  select count(*) into n from public.workout_sets where owner_id = a;
  if n <> 1 then raise exception 'FAIL: owner should see own sets'; end if;
  select count(*) into n from public.notifications where kind in ('friend_request', 'like', 'comment');
  if n <> 3 then raise exception 'FAIL: A should have request, like and comment notifications (got %)', n; end if;
  update public.friendships set status = 'accepted' where user_a = least(a, c) and user_b = greatest(a, c);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: recipient should accept the request'; end if;
  if (select accepted_at from public.friendships where user_a = least(a, c) and user_b = greatest(a, c)) is null then
    raise exception 'FAIL: accepted_at should be set';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.workouts where owner_id = a;
  if n <> 1 then raise exception 'FAIL: new friend should now see the workout'; end if;
  select count(*) into n from public.notifications where kind = 'friend_accepted';
  if n <> 1 then raise exception 'FAIL: requester should be told the request was accepted'; end if;

  -- A blocks C: friendship ends, C can't see A at all.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.blocks (blocked_id) values (c);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.friendships;
  if n <> 0 then raise exception 'FAIL: a block should remove the friendship'; end if;
  select count(*) into n from public.profiles where id = a;
  if n <> 0 then raise exception 'FAIL: blocked user should not find the blocker'; end if;
  failed := false;
  begin
    insert into public.friendships (user_a, user_b, requested_by) values (least(a, c), greatest(a, c), c);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: blocked user should not send a request'; end if;

  -- Anonymous ------------------------------------------------------------------
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.profiles;
  if n <> 0 then raise exception 'FAIL: anon should not list profiles'; end if;
  if public.username_available('RLS_a') then raise exception 'FAIL: taken username (other casing) reported available'; end if;
  if not public.username_available('Rls_New') then raise exception 'FAIL: capitals should be allowed'; end if;
  if not public.username_available('rls_new') then raise exception 'FAIL: free username reported taken'; end if;
  if public.username_available('No Spaces') then raise exception 'FAIL: invalid username reported available'; end if;

  raise exception 'ALL RLS TESTS PASSED';
end;
$$;
