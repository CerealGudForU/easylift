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
  insert into public.workout_sets (owner_id, workout_id, workout_exercise_id, weight_kg, reps, completed_at)
    values (a, w_public, we, 80, 8, now());
  -- Photos: one on the visible workout, one on the private one.
  insert into storage.objects (bucket_id, name) values
    ('workout-photos', a::text || '/' || w_public::text || '/p.jpg'),
    ('workout-photos', a::text || '/' || w_private::text || '/p.jpg');
  insert into public.workout_photos (workout_id, owner_id, path, width, height, crop_x, crop_y, crop_w, crop_h) values
    (w_public, a, a::text || '/' || w_public::text || '/p.jpg', 1200, 900, 0.1, 0, 0.5, 1),
    (w_private, a, a::text || '/' || w_private::text || '/p.jpg', 1000, 1000, 0, 0, 1, 1);
  failed := false;
  begin
    insert into public.workout_photos (workout_id, owner_id, path, width, height)
      values (w_public, a, b::text || '/' || w_public::text || '/p.jpg', 10, 10);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: a photo path outside the owner''s folder should be rejected'; end if;
  failed := false;
  begin
    update public.workout_photos set crop_x = 0.8, crop_w = 0.5 where workout_id = w_public;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: a crop outside the photo should be rejected'; end if;
  -- Two older workouts of B's own, so B's feed has three entries to page through.
  insert into public.workouts (owner_id, started_at, ended_at) values
    (b, now() - interval '3 hours', now() - interval '2 hours'),
    (b, now() - interval '5 hours', now() - interval '4 hours');

  execute 'set local role authenticated';

  -- B: friend ----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.workouts where owner_id = a;
  if n <> 1 then raise exception 'FAIL: friend should see only the finished friends workout (saw %)', n; end if;
  select count(*) into n from public.workout_sets where workout_id = w_public;
  if n <> 1 then raise exception 'FAIL: friend should see the sets of a visible workout'; end if;
  insert into public.likes (workout_id) values (w_public);
  insert into public.comments (workout_id, body) values (w_public, 'Strong!');

  -- Feed: A's visible workout plus B's own two; never A's private or unfinished ones.
  select count(*) into n from public.get_feed(null, null, 50);
  if n <> 3 then raise exception 'FAIL: friend''s feed should have 3 workouts (got %)', n; end if;
  select count(*) into n from public.get_feed(null, null, 50) f where f.id in (w_private, w_open);
  if n <> 0 then raise exception 'FAIL: feed leaked a private or unfinished workout'; end if;
  if not exists (
    select 1 from public.get_feed(null, null, 50) f
    where f.id = w_public and f.liked and f.like_count = 1 and f.comment_count = 1
      and f.set_count = 1 and f.volume_kg = 640 and f.top_exercises -> 0 ->> 'name' = 'RLS test press'
  ) then
    raise exception 'FAIL: feed row should carry likes, comments, sets, volume and exercise names';
  end if;
  -- Keyset pagination: two pages (2 + 1), no overlap, newest first.
  declare
    last_started timestamptz;
    last_id uuid;
  begin
    select f.started_at, f.id into last_started, last_id
      from public.get_feed(null, null, 2) f order by f.started_at asc, f.id asc limit 1;
    select count(*) into n from public.get_feed(last_started, last_id, 2);
    if n <> 1 then raise exception 'FAIL: second feed page should have 1 workout (got %)', n; end if;
    select count(*) into n from public.get_feed(last_started, last_id, 2) f
      where f.id in (select g.id from public.get_feed(null, null, 2) g);
    if n <> 0 then raise exception 'FAIL: feed pages overlap'; end if;
  end;
  if not exists (select 1 from public.search_profiles('rls_') s where s.id = a and s.status = 'friends') then
    raise exception 'FAIL: search should show A as a friend';
  end if;
  if exists (select 1 from public.search_profiles('rls_b') s where s.id = b) then
    raise exception 'FAIL: search should not return yourself';
  end if;
  if exists (select 1 from public.search_profiles('rls%')) then
    raise exception 'FAIL: search wildcards should be literal';
  end if;
  select count(*) into n from storage.objects where bucket_id = 'workout-photos' and name like a::text || '/%';
  if n <> 1 then raise exception 'FAIL: friend should see only the visible workout''s photo (saw %)', n; end if;
  if not exists (
    select 1 from public.get_feed(null, null, 50) f
    where f.id = w_public and jsonb_array_length(f.photos) = 1 and (f.photos -> 0 ->> 'crop_w')::real = 0.5
  ) then
    raise exception 'FAIL: feed should carry the photo with its crop';
  end if;
  select count(*) into n from public.workout_photos where owner_id = a;
  if n <> 1 then raise exception 'FAIL: friend should see only the visible workout''s photo row (saw %)', n; end if;
  update public.workout_photos set crop_x = 0 where owner_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: friend should not re-crop the owner''s photo'; end if;
  failed := false;
  begin
    insert into public.workout_photos (workout_id, owner_id, path, width, height)
      values (w_public, b, b::text || '/' || w_public::text || '/x.jpg', 10, 10);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: adding a photo to someone else''s workout should fail'; end if;
  -- Working out now: the friend sees when A's open workout started (A's open workout is friends-visible).
  if not exists (select 1 from public.friends_now() f where f.id = a and f.active_since is not null) then
    raise exception 'FAIL: friend should see that A is working out now';
  end if;
  if (select status from public.get_profile(a)) <> 'friends' then
    raise exception 'FAIL: profile should say friends';
  end if;
  select count(*) into n from public.get_profile_workouts(a);
  if n <> 1 then raise exception 'FAIL: friend should see A''s one visible finished workout in profile stats (saw %)', n; end if;
  if not exists (select 1 from public.get_profile_exercises(a) x where x.name = 'RLS test press' and x.best_weight_kg = 80) then
    raise exception 'FAIL: friend should see A''s top exercise with its best set';
  end if;
  select count(*) into n from public.get_feed(null, null, 50, a);
  if n <> 1 then raise exception 'FAIL: feed for one owner should only have A''s visible workout (got %)', n; end if;
  -- Comment likes and exercise history.
  insert into public.comment_likes (comment_id) select id from public.comments where workout_id = w_public;
  if not exists (select 1 from public.get_comments(w_public) x where x.body = 'Strong!' and x.like_count = 1 and x.liked) then
    raise exception 'FAIL: friend should see their like on the comment';
  end if;
  if not exists (
    select 1 from public.get_feed(null, null, 50) f
    where f.id = w_public and (f.comments -> 0 ->> 'like_count')::int = 1 and (f.comments -> 0 ->> 'liked')::boolean
  ) then
    raise exception 'FAIL: feed should carry comments with their likes';
  end if;
  select count(*) into n from public.get_profile_exercise_history(a, ex);
  if n <> 1 then raise exception 'FAIL: friend should see A''s one session of the exercise (got %)', n; end if;
  failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('workout-photos', a::text || '/' || w_public::text || '/evil.jpg');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: uploading into someone else''s photo folder should fail'; end if;

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
  select count(*) into n from public.get_feed(null, null, 50);
  if n <> 0 then raise exception 'FAIL: stranger''s feed should be empty (got %)', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'workout-photos' and name like a::text || '/%';
  if n <> 0 then raise exception 'FAIL: stranger should see no photos (saw %)', n; end if;
  select count(*) into n from public.workout_photos where owner_id = a;
  if n <> 0 then raise exception 'FAIL: stranger should see no photo rows (saw %)', n; end if;
  if (select active_since from public.get_profile(a)) is not null then
    raise exception 'FAIL: stranger should not see that A is working out';
  end if;
  if (select status from public.get_profile(a)) <> 'none' then raise exception 'FAIL: stranger profile status should be none'; end if;
  select count(*) into n from public.get_profile_workouts(a);
  if n <> 0 then raise exception 'FAIL: stranger should get no profile workouts (got %)', n; end if;
  select count(*) into n from public.get_profile_exercises(a);
  if n <> 0 then raise exception 'FAIL: stranger should get no profile exercises (got %)', n; end if;
  select count(*) into n from public.friends_now();
  if n <> 0 then raise exception 'FAIL: stranger has no friends to list (got %)', n; end if;
  select count(*) into n from public.get_comments(w_public);
  if n <> 0 then raise exception 'FAIL: stranger should see no comments via get_comments (got %)', n; end if;
  select count(*) into n from public.comment_likes;
  if n <> 0 then raise exception 'FAIL: stranger should see no comment likes (got %)', n; end if;
  failed := false;
  begin
    insert into public.comment_likes (comment_id) select id from public.comments where workout_id = w_public;
    get diagnostics n = row_count;
    if n = 0 then failed := true; end if;  -- can't even see the comment to like it
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: stranger should not like a comment'; end if;
  select count(*) into n from public.get_profile_exercise_history(a, ex);
  if n <> 0 then raise exception 'FAIL: stranger should get no exercise history (got %)', n; end if;
  if not exists (select 1 from public.search_profiles('RLS_A') s where s.id = a and s.status = 'none') then
    raise exception 'FAIL: stranger should find A by username search, ignoring case';
  end if;

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
  select count(*) into n from storage.objects where bucket_id = 'workout-photos' and name like a::text || '/%';
  if n <> 2 then raise exception 'FAIL: owner should see both own photos (saw %)', n; end if;
  select count(*) into n from public.notifications where kind in ('friend_request', 'like', 'comment');
  if n <> 3 then raise exception 'FAIL: A should have request, like and comment notifications (got %)', n; end if;
  if not exists (select 1 from public.list_friends() f where f.id = c and f.status = 'received') then
    raise exception 'FAIL: A should see C''s request as received';
  end if;
  if not exists (select 1 from public.list_friends() f where f.id = b and f.status = 'friends') then
    raise exception 'FAIL: A should see B as a friend';
  end if;
  select count(*) into n from public.get_feed(null, null, 50);
  if n <> 3 then raise exception 'FAIL: A''s feed should have own visible workout + B''s two (got %)', n; end if;
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
  if exists (select 1 from public.search_profiles('rls_a')) then
    raise exception 'FAIL: blocked user should not find the blocker by search';
  end if;
  select count(*) into n from public.get_feed(null, null, 50);
  if n <> 0 then raise exception 'FAIL: after a block, the feed should be empty (got %)', n; end if;

  -- Anonymous ------------------------------------------------------------------
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.profiles;
  if n <> 0 then raise exception 'FAIL: anon should not list profiles'; end if;
  failed := false;
  begin
    perform public.get_feed(null, null, 10);
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAIL: anon should not read the feed'; end if;
  if public.username_available('RLS_a') then raise exception 'FAIL: taken username (other casing) reported available'; end if;
  if not public.username_available('Rls_New') then raise exception 'FAIL: capitals should be allowed'; end if;
  if not public.username_available('rls_new') then raise exception 'FAIL: free username reported taken'; end if;
  if public.username_available('No Spaces') then raise exception 'FAIL: invalid username reported available'; end if;

  raise exception 'ALL RLS TESTS PASSED';
end;
$$;
