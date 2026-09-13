-- v_today_tasks — TZ-aware view that buckets tasks into today / tomorrow / backlog.
-- Backlog = anything else not completed (overdue OR scheduled past tomorrow).
-- Completed tasks remain visible while their scheduled_date is today or in the future,
-- so the user sees what they've crossed off until the day rolls over in their TZ.

create or replace view v_today_tasks as
with user_today as (
  select id as user_id, (now() at time zone time_zone)::date as today
  from users
)
select
  t.id              as task_id,
  t.user_id,
  t.title,
  t.scheduled_date,
  t.scheduled_time,
  t.area,
  t.notes,
  t.weekly_commitment_id,
  t.completed_at,
  t.created_at,
  c.today           as today_in_tz,
  case
    when t.scheduled_date = c.today     then 'today'
    when t.scheduled_date = c.today + 1 then 'tomorrow'
    else 'backlog'
  end as bucket
from tasks t
join user_today c on c.user_id = t.user_id
where t.completed_at is null
   or t.scheduled_date >= c.today
order by t.scheduled_date, t.scheduled_time nulls last, t.created_at;
