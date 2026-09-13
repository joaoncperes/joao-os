-- 047_friday_straight_bar_pushdown_to_scott_curl.sql
-- Pedro: replace Friday's "Straight Bar Pushdown" (triceps) with "Scott Curl"
-- (biceps). Straight Bar Pushdown only lives on Friday's split, so the global
-- match is unambiguous. Past exercise_sets continue to point at Straight Bar
-- Pushdown — they should reflect the triceps work that was actually performed.
-- Idempotent.

-- 1. Ensure the Scott Curl exercise exists for every user that has a Straight
--    Bar Pushdown. (Using `do nothing` on the (user_id, name) unique constraint.)
insert into exercises (user_id, name, type, muscle_group_primary)
select distinct e.user_id, 'Scott Curl', 'isolation', 'arms'
from exercises e
where e.name = 'Straight Bar Pushdown'
on conflict (user_id, name) do nothing;

-- 2. Repoint Friday's split row from Straight Bar Pushdown → Scott Curl.
update workout_split_exercises wse
set exercise_id = sc.id
from workout_split ws,
     exercises sbp,
     exercises sc
where wse.workout_split_id = ws.id
  and ws.day_of_week        = 5
  and wse.exercise_id       = sbp.id
  and sbp.name              = 'Straight Bar Pushdown'
  and sbp.user_id           = wse.user_id
  and sc.name               = 'Scott Curl'
  and sc.user_id            = wse.user_id;
