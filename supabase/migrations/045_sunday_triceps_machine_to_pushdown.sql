-- 043_sunday_triceps_machine_to_pushdown.sql
-- Pedro: rename Sunday's "Triceps Machine" slot to "Triceps Pushdown".
-- Sunday's split keeps 6 exercises; Friday's Triceps Machine row is untouched.
-- Historical exercise_sets logged against "Triceps Machine" remain labeled as
-- such (the exercise row is not renamed or deleted — only the Sunday
-- workout_split_exercises row is repointed).

-- 1. Make sure the Triceps Pushdown exercise exists for every user that has a
--    Triceps Machine. Idempotent via the (user_id, name) unique constraint.
insert into exercises (user_id, name, type, muscle_group_primary)
select distinct e.user_id, 'Triceps Pushdown', 'isolation', 'arms'
from exercises e
where e.name = 'Triceps Machine'
on conflict (user_id, name) do nothing;

-- 2. Repoint Sunday's split row from Triceps Machine → Triceps Pushdown.
update workout_split_exercises wse
set exercise_id = tp.id
from workout_split ws,
     exercises tm,
     exercises tp
where wse.workout_split_id = ws.id
  and ws.day_of_week        = 0
  and wse.exercise_id       = tm.id
  and tm.name               = 'Triceps Machine'
  and tm.user_id            = wse.user_id
  and tp.name               = 'Triceps Pushdown'
  and tp.user_id            = wse.user_id;
