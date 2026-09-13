-- 044_friday_triceps_machine_to_overhead_cable_triceps.sql
-- Pedro: replace Triceps Machine with Overhead Cable Triceps on Friday's split only.
-- Triceps Machine remains on Sunday's split (day_of_week = 0); we identify rows by
-- joining workout_split (day_of_week = 5) with exercise name to avoid touching it.
-- Past workout_set rows continue to point at Triceps Machine — they should reflect
-- the exercise that was actually performed at the time. Idempotent.

-- 1. Ensure the Overhead Cable Triceps exercise exists for each user that has
--    Triceps Machine. (Using `do nothing` on the (user_id, name) unique constraint.)
insert into exercises (user_id, name, type, muscle_group_primary)
select distinct e.user_id, 'Overhead Cable Triceps', 'isolation', 'arms'
from exercises e
where e.name = 'Triceps Machine'
on conflict (user_id, name) do nothing;

-- 2. Repoint Friday's split row from Triceps Machine → Overhead Cable Triceps.
update workout_split_exercises wse
set exercise_id = oct.id
from workout_split ws,
     exercises tm,
     exercises oct
where wse.workout_split_id = ws.id
  and ws.day_of_week        = 5
  and wse.exercise_id       = tm.id
  and tm.name               = 'Triceps Machine'
  and tm.user_id            = wse.user_id
  and oct.name              = 'Overhead Cable Triceps'
  and oct.user_id           = wse.user_id;
