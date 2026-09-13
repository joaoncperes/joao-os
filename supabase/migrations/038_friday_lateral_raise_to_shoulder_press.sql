-- 038_friday_lateral_raise_to_shoulder_press.sql
-- Pedro: replace Lateral Raise with Shoulder Press on Friday's split only.
-- Single-user app, so we identify rows by joining workout_split (day_of_week = 5)
-- with exercise name. The Sunday Lateral Raise (day_of_week = 0) is unchanged.

-- 1. Ensure the Shoulder Press exercise exists for each user that has a Lateral
--    Raise. (Using `do nothing` on the (user_id, name) unique constraint.)
insert into exercises (user_id, name, type, muscle_group_primary)
select distinct e.user_id, 'Shoulder Press', 'compound', 'shoulders'
from exercises e
where e.name = 'Lateral Raise'
on conflict (user_id, name) do nothing;

-- 2. Repoint Friday's split row from Lateral Raise → Shoulder Press.
update workout_split_exercises wse
set exercise_id = sp.id
from workout_split ws,
     exercises lr,
     exercises sp
where wse.workout_split_id = ws.id
  and ws.day_of_week        = 5
  and wse.exercise_id       = lr.id
  and lr.name               = 'Lateral Raise'
  and lr.user_id            = wse.user_id
  and sp.name               = 'Shoulder Press'
  and sp.user_id            = wse.user_id;
