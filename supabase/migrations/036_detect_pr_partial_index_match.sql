-- 036_detect_pr_partial_index_match.sql
-- Fix: detect_pr() trigger uses `on conflict (set_id, pr_type) do nothing`,
-- but the only unique index on personal_records(set_id, pr_type) is PARTIAL
-- (where set_id is not null — see migration 006). Postgres cannot infer a
-- partial unique index for ON CONFLICT without the index predicate, so every
-- exercise_sets insert/update raised:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- which surfaced in the Workout screen any time the user saved reps or load.
--
-- Fix forever by adding `where set_id is not null` to both ON CONFLICT clauses
-- so they match the partial index predicate.

create or replace function detect_pr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_weight numeric;
  v_max_volume numeric;
  v_set_volume numeric;
begin
  if NEW.is_warmup then
    return NEW;
  end if;
  if NEW.weight_kg is null or NEW.reps is null or NEW.reps = 0 then
    return NEW;
  end if;

  v_set_volume := NEW.weight_kg * NEW.reps;

  -- max_weight PR
  select max(weight_kg) into v_max_weight
  from exercise_sets
  where user_id = NEW.user_id
    and exercise_id = NEW.exercise_id
    and is_warmup = false
    and id <> NEW.id;

  if v_max_weight is null or NEW.weight_kg > v_max_weight then
    insert into personal_records
      (user_id, exercise_id, pr_type, weight_kg, reps, set_id, achieved_at)
    values
      (NEW.user_id, NEW.exercise_id, 'max_weight', NEW.weight_kg, NEW.reps, NEW.id, now())
    on conflict (set_id, pr_type) where set_id is not null do nothing;
  end if;

  -- max_volume_session PR (single-set volume)
  select max(coalesce(weight_kg, 0) * coalesce(reps, 0)) into v_max_volume
  from exercise_sets
  where user_id = NEW.user_id
    and exercise_id = NEW.exercise_id
    and is_warmup = false
    and id <> NEW.id;

  if v_max_volume is null or v_set_volume > v_max_volume then
    insert into personal_records
      (user_id, exercise_id, pr_type, weight_kg, reps, set_id, achieved_at)
    values
      (NEW.user_id, NEW.exercise_id, 'max_volume_session', NEW.weight_kg, NEW.reps, NEW.id, now())
    on conflict (set_id, pr_type) where set_id is not null do nothing;
  end if;

  return NEW;
end $$;
