-- Calendar tab: finished workouts in a date range for you and your friends, so the
-- calendar can mark the days each friend trained. Your own workouts also carry their
-- first photo (for the photo underline and preview); friends' rows never do.
-- SECURITY INVOKER: RLS on workouts stays the gate, plus the same visibility rule as the feed.
create function public.get_calendar(from_ts timestamptz, to_ts timestamptz)
returns table (workout_id uuid, owner_id uuid, username text, title text, started_at timestamptz, photo jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id, w.owner_id, p.username::text, w.title, w.started_at,
    case when w.owner_id = (select auth.uid()) then (
      select jsonb_build_object(
        'id', ph.id, 'path', ph.path, 'width', ph.width, 'height', ph.height,
        'crop_x', ph.crop_x, 'crop_y', ph.crop_y, 'crop_w', ph.crop_w, 'crop_h', ph.crop_h)
      from public.workout_photos ph
      where ph.workout_id = w.id
      order by ph.position, ph.created_at
      limit 1
    ) end
  from public.workouts w
  join public.profiles p on p.id = w.owner_id
  where w.deleted_at is null
    and w.ended_at is not null
    and w.started_at >= from_ts
    and w.started_at < to_ts
    -- At most about three months per call.
    and to_ts - from_ts <= interval '100 days'
    and (
      w.owner_id = (select auth.uid())
      or (w.visibility = 'friends' and private.is_friend((select auth.uid()), w.owner_id))
    )
  order by w.started_at
  limit 3000;
$$;

revoke execute on function public.get_calendar(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_calendar(timestamptz, timestamptz) to authenticated;
