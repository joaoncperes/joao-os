-- =============================================================
-- 062_habits_for_date.sql
-- Date-parameterized habit fetch — same shape as v_today_habits but for an
-- arbitrary date, so the Today screen can show/edit past days. security
-- invoker + auth.uid() filter (RLS on habits/habit_logs still applies).
-- =============================================================
create or replace function habits_for_date(target_date date)
returns table(
  habit_id uuid,
  user_id uuid,
  name text,
  area text,
  time_slot time,
  is_counter boolean,
  counter_target_value numeric,
  counter_unit text,
  sort_order int,
  completed_at timestamptz,
  logged_value numeric,
  miss_reason text,
  notes text,
  freeze_used boolean,
  today_in_tz date,
  if_missed_plan text,
  anchor_habit_id uuid,
  anchor_habit_name text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    h.id, h.user_id, h.name, h.area, h.time_slot, h.is_counter,
    h.counter_target_value, h.counter_unit, h.sort_order,
    hl.completed_at, hl.value, hl.miss_reason, hl.notes, hl.freeze_used,
    target_date,                 -- mirrors v_today_habits.today_in_tz
    h.if_missed_plan, h.anchor_habit_id, a.name
  from habits h
  left join habits a on a.id = h.anchor_habit_id
  left join habit_logs hl on hl.habit_id = h.id and hl.log_date = target_date
  where h.user_id = auth.uid() and h.archived = false
  order by h.time_slot nulls last, h.sort_order;
$$;

grant execute on function habits_for_date(date) to authenticated;
