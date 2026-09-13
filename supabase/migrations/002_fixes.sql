-- =============================================================
-- 002_fixes.sql
-- TZ-aware "today" view + any other post-schema fixes.
--
-- The original schema's v_today_habits used `current_date` which
-- is UTC on Supabase. Pedro is in São Paulo (UTC-3), so before
-- 03:00 UTC the view would show the previous day. This version
-- reads users.time_zone and computes today in that zone.
-- =============================================================

create or replace view v_today_habits as
select
  h.id as habit_id,
  h.user_id,
  h.name,
  h.area,
  h.time_slot,
  h.is_counter,
  h.counter_target_value,
  h.counter_unit,
  h.sort_order,
  hl.completed_at,
  hl.value as logged_value,
  hl.miss_reason,
  hl.notes,
  hl.freeze_used,
  -- the date this row is "for" — computed in the user's TZ
  (now() at time zone u.time_zone)::date as today_in_tz
from habits h
join users u on u.id = h.user_id
left join habit_logs hl
  on hl.habit_id = h.id
  and hl.log_date = (now() at time zone u.time_zone)::date
where h.archived = false
order by h.time_slot nulls last, h.sort_order;

-- Helper RPC: get today's date in the calling user's TZ.
-- The Today server-component calls this so it doesn't have to embed TZ logic.
create or replace function today_in_user_tz()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone u.time_zone)::date
  from public.users u
  where u.id = auth.uid()
$$;

grant execute on function today_in_user_tz() to authenticated;
