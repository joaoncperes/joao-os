-- Derived reminder: no new log or scheduled job is needed.
-- Append columns to preserve existing view consumers.
create or replace view public.v_today_habits
with (security_invoker = true) as
select
  h.id as habit_id, h.user_id, h.name, h.area, h.time_slot,
  h.is_counter, h.counter_target_value, h.counter_unit, h.sort_order,
  hl.completed_at, hl.value as logged_value, hl.miss_reason, hl.notes,
  hl.freeze_used,
  (now() at time zone u.time_zone)::date as today_in_tz,
  h.if_missed_plan, h.anchor_habit_id, a.name as anchor_habit_name,
  (
    (h.created_at at time zone u.time_zone)::date
      < (now() at time zone u.time_zone)::date - 1
    and yesterday.completed_at is null
    and not coalesce(yesterday.freeze_used, false)
  ) as missed_yesterday
from public.habits h
join public.users u on u.id = h.user_id
left join public.habits a on a.id = h.anchor_habit_id
left join public.habit_logs hl
  on hl.habit_id = h.id and hl.user_id = h.user_id
  and hl.log_date = (now() at time zone u.time_zone)::date
left join public.habit_logs yesterday
  on yesterday.habit_id = h.id and yesterday.user_id = h.user_id
  and yesterday.log_date = (now() at time zone u.time_zone)::date - 1
where h.archived = false and h.user_id = auth.uid()
order by h.time_slot nulls last, h.sort_order;
