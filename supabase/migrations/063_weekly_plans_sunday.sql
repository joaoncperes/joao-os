-- 063_weekly_plans_sunday.sql
-- Weekly planning weeks become Sunday-anchored (Sun..Sat), matching the workout
-- screens. Re-keys weekly_plans from (user, iso_year, iso_week) to
-- (user, week_start_date), where week_start_date becomes the SUNDAY of the week.
-- iso_year/iso_week become vestigial (kept nullable, no longer written).

-- 1. Relax the now-vestigial NOT NULLs so the app can stop writing iso_year/iso_week.
alter table weekly_plans alter column iso_year drop not null;
alter table weekly_plans alter column iso_week drop not null;

-- 2. Re-anchor existing rows from ISO-Monday to the Sunday that starts the same
--    Sun..Sat week. Defensive: snap ANY date to its Sunday via dow (0=Sun..6=Sat);
--    guarded to Mondays so a re-run can't shift dates twice.
update weekly_plans
   set week_start_date = week_start_date - extract(dow from week_start_date)::int
 where extract(dow from week_start_date) = 1;   -- 1 = Monday

-- 3. Swap the uniqueness key to the Sunday week_start_date (after the update).
alter table weekly_plans
  drop constraint if exists weekly_plans_user_id_iso_year_iso_week_key;
alter table weekly_plans
  add constraint weekly_plans_user_week_start_key unique (user_id, week_start_date);

-- 4. v_weekly_habit_summary -> Sunday-anchored week_start.
--    dow 0=Sun..6=Sat, so (log_date - dow) lands on the Sunday for every weekday.
create or replace view v_weekly_habit_summary
with (security_invoker = true)
as
select
  hl.user_id,
  hl.habit_id,
  h.name as habit_name,
  h.area,
  (hl.log_date - extract(dow from hl.log_date)::int)::date as week_start,
  count(*) filter (where hl.completed_at is not null)::int as completed_count,
  count(*)::int as total_logged
from habit_logs hl
join habits h on h.id = hl.habit_id
group by hl.user_id, hl.habit_id, h.name, h.area, week_start;
