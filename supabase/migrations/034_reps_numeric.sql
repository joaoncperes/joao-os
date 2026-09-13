-- Allow non-integer reps (e.g., 7.5 for half-reps).
-- Mirrors weight_kg's numeric(6,2) precision pattern.

-- Drop dependents that reference reps so we can alter the column type.
drop trigger if exists exercise_sets_pr_check on exercise_sets;
drop view if exists v_last_set_per_exercise;

alter table exercise_sets
  alter column reps type numeric(5,2) using reps::numeric(5,2);

alter table personal_records
  alter column reps type numeric(5,2) using reps::numeric(5,2);

-- Recreate the view (definition copied from 000_schema.sql).
create or replace view v_last_set_per_exercise as
select distinct on (es.exercise_id)
  es.user_id,
  es.exercise_id,
  e.name as exercise_name,
  es.weight_kg,
  es.reps,
  es.rpe,
  es.completed_at
from exercise_sets es
join exercises e on e.id = es.exercise_id
where es.is_warmup = false
order by es.exercise_id, es.completed_at desc;

-- Recreate the trigger (function body is unchanged and works with numeric).
create trigger exercise_sets_pr_check
  after insert or update of weight_kg, reps, is_warmup
  on exercise_sets
  for each row execute function detect_pr();
