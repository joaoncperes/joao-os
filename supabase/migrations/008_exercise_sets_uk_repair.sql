-- 008_exercise_sets_uk_repair.sql
-- Repair: ensure the (session_id, exercise_id, set_number) unique constraint
-- on exercise_sets exists. Required for the upsert in
-- app/(app)/workout/actions.ts:upsertSet. Original migration 003 is recorded
-- as applied on the remote project but the constraint is missing at runtime
-- (Postgres errors with "no unique or exclusion constraint matching the
-- ON CONFLICT specification"). This migration is idempotent.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.exercise_sets'::regclass
      and conname  = 'exercise_sets_session_exercise_set_uk'
  ) then
    alter table public.exercise_sets
      add constraint exercise_sets_session_exercise_set_uk
      unique (session_id, exercise_id, set_number);
  end if;
end$$;
